"use client";

/**
 * SPEC-730 · La REJILLA presentacional compartida del calendario.
 *
 * Extraída de `CalendarioProfesional` (SPEC-714) para que el profesional (publica
 * franjas y responde solicitudes) Y el padre (elige franja / ve sus citas) pinten
 * la MISMA cuadrícula, sin duplicarla (radicado SPEC-730). Es puro presentacional:
 *  - geometría (riel de horas, columnas por día, posición del bloque por minutos);
 *  - voz NEUTRA (fuera de `profesional/` y `padre/`): sin «usted» ni «tú».
 * Cada lado inyecta el CONTENIDO del bloque (`renderBloque`), los overlays propios
 * (muro de vigencia / día bloqueado del profesional; nada en el padre), y —solo el
 * profesional— los gestos de arrastrar-para-crear. El padre la usa en solo lectura.
 */
import type { ReactNode } from "react";
import { DOW, H0, H1, PXH, diaSemana, estiloBloque, fmt, numMes } from "./fechas";

/** Lo mínimo que la rejilla necesita de un bloque para posicionarlo. */
export interface BloquePosicionado {
    id: string;
    minInicio: number;
    minFin: number;
}

export function RejillaCalendario<T extends BloquePosicionado>(props: {
    /** Días visibles (`yyyy-MM-dd` Bogotá), en orden. */
    diasVisibles: string[];
    /** Hoy (`yyyy-MM-dd` Bogotá) — resalta el día. */
    hoy: string;
    /** `grid-template-columns` del área de días (1 col en vista día, 7 en semana). */
    anchoDia: string;
    bloquesPorDia: Map<string, T[]>;
    /** El bloque ya posicionado y estilado por el lado que lo usa (usa `estiloBloque`). */
    renderBloque: (bloque: T) => ReactNode;
    /** Vista previa del arrastre (solo profesional). */
    ghost?: { fecha: string; a: number; b: number } | null;
    /** Clase extra para el encabezado del día (p. ej. ámbar de día bloqueado). */
    diaHeaderTono?: (fecha: string) => string | undefined;
    /** Overlays dentro de la columna del día (muro/bloqueado del profesional). */
    overlayDia?: (fecha: string) => ReactNode;
    onDiaHeaderClick?: (fecha: string) => void;
    onColumnaPointerDown?: (e: React.PointerEvent, fecha: string) => void;
    onColumnaPointerMove?: (e: React.PointerEvent) => void;
    onColumnaPointerUp?: (e: React.PointerEvent) => void;
    /** Overlays absolutos dentro del contenedor relativo (popovers/paneles del lado). */
    children?: ReactNode;
}) {
    const { diasVisibles, hoy, anchoDia, bloquesPorDia, renderBloque, ghost } = props;
    const altura = (H1 - H0) * PXH;
    return (
        <div className="relative overflow-x-auto rounded-xl border border-tinta/10 bg-page">
            <div className="grid border-b border-tinta/10" style={{ gridTemplateColumns: `56px ${anchoDia}` }}>
                <div />
                {diasVisibles.map((d) => {
                    const tono = props.diaHeaderTono?.(d);
                    return (
                        <button key={d} className="border-l border-tinta/10 py-2 text-center hover:bg-tinta/5" onClick={() => props.onDiaHeaderClick?.(d)}>
                            <div className={`font-mono text-[10px] uppercase ${tono ?? "text-subtle"}`}>{DOW[diaSemana(d)]}</div>
                            <div className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${d === hoy ? "bg-cielo text-white" : tono ?? "text-body"}`}>{numMes(d)}</div>
                        </button>
                    );
                })}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `56px ${anchoDia}`, height: altura }}>
                <div className="border-r border-tinta/10">
                    {Array.from({ length: H1 - H0 }, (_, i) => (
                        <div key={i} className="relative text-right font-mono text-[10px] text-subtle" style={{ height: PXH }}>
                            <span className="pr-1.5" style={{ position: "relative", top: -6 }}>{fmt((H0 + i) * 60)}</span>
                        </div>
                    ))}
                </div>
                {diasVisibles.map((fecha) => {
                    const g = ghost && ghost.fecha === fecha ? estiloBloque(ghost.a, ghost.b) : null;
                    return (
                        <div
                            key={fecha}
                            className="relative touch-none border-l border-tinta/10"
                            style={{ height: altura }}
                            data-col={fecha}
                            onPointerDown={props.onColumnaPointerDown ? (e) => props.onColumnaPointerDown!(e, fecha) : undefined}
                            onPointerMove={props.onColumnaPointerMove}
                            onPointerUp={props.onColumnaPointerUp}
                        >
                            {Array.from({ length: H1 - H0 }, (_, i) => (
                                <div key={i} className="border-b border-tinta/5" style={{ height: PXH }} />
                            ))}
                            {props.overlayDia?.(fecha)}
                            {g && ghost && (
                                <div
                                    className="pointer-events-none absolute inset-x-1 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-cielo bg-cielo/20 font-mono text-[11px] font-semibold text-cielo-700"
                                    style={{ top: g.top, height: g.height }}
                                >
                                    {fmt(ghost.a)} – {fmt(ghost.b)}
                                </div>
                            )}
                            {(bloquesPorDia.get(fecha) ?? []).map((b) => renderBloque(b))}
                        </div>
                    );
                })}
            </div>
            {props.children}
        </div>
    );
}

export function BellIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a24 24 0 005.454-1.31A8.97 8.97 0 0118 9.75V9A6 6 0 006 9v.75a8.97 8.97 0 01-2.312 6.022 24 24 0 005.455 1.31m5.714 0a24 24 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
    );
}
