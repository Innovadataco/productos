"use client";

/** SPEC-714 · La columna de un día y el bloque de una franja (rejilla del calendario). */
import type { BloqueCalendario, EstadoBloque } from "@/lib/profesional/calendario/calendario.service";
import { H0, H1, PXH, fmt } from "./fechas";

export function ColumnaDia(props: {
    fecha: string;
    bloques: BloqueCalendario[];
    ghost: { a: number; b: number } | null;
    altura: number;
    muro: { fecha: string; minuto: number } | null;
    bloqueado: boolean;
    sel: Set<string>;
    selModo: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onBloque: (b: BloqueCalendario) => void;
    onQuitar: (id: string) => void;
}) {
    const { fecha, bloques, ghost, altura, muro, bloqueado } = props;
    // Muro de vigencia: y (px) donde empieza la zona rayada en este día. Comparación
    // pura contra el muro que ya proyectó el servidor a Bogotá — sin zona horaria acá.
    let muroTop: number | null = null;
    if (muro) {
        if (fecha > muro.fecha) muroTop = 0; // día entero fuera de vigencia
        else if (fecha === muro.fecha) muroTop = Math.max(0, (muro.minuto / 60 - H0) * PXH);
    }
    return (
        <div
            className="relative touch-none border-l border-tinta/10"
            style={{ height: altura }}
            data-col={fecha}
            onPointerDown={props.onPointerDown}
            onPointerMove={props.onPointerMove}
            onPointerUp={props.onPointerUp}
        >
            {Array.from({ length: H1 - H0 }, (_, i) => (
                <div key={i} className="border-b border-tinta/5" style={{ height: PXH }} />
            ))}
            {bloqueado && (
                // SPEC-714 · día cerrado: rayado ámbar durable (reflejo de la fila DiaBloqueado).
                // Va detrás de las franjas (z-0): las citas confirmadas se conservan y se ven encima.
                <div className="pointer-events-none absolute inset-0 z-0 bg-[repeating-linear-gradient(135deg,rgb(var(--ambar-ink-rgb)/0.1)_0_6px,transparent_6px_12px)]" aria-hidden="true" />
            )}
            {muroTop !== null && (
                <div
                    className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-tinta/25 bg-[repeating-linear-gradient(135deg,rgb(var(--tinta-rgb)/0.06)_0_6px,transparent_6px_12px)]"
                    style={{ top: muroTop, height: altura - muroTop }}
                >
                    {muroTop > 10 && <span className="m-1 inline-block rounded bg-page px-1.5 py-0.5 font-mono text-[10px] text-subtle">Su verificación vence — no puede ofrecer horas después</span>}
                </div>
            )}
            {ghost && (
                <div className="pointer-events-none absolute inset-x-1 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-cielo bg-cielo/20 font-mono text-[11px] font-semibold text-cielo-700"
                    style={{ top: (ghost.a / 60 - H0) * PXH, height: ((ghost.b - ghost.a) / 60) * PXH }}>
                    {fmt(ghost.a)} – {fmt(ghost.b)}
                </div>
            )}
            {bloques.map((b) => (
                <BloqueFranja key={b.id} b={b} sel={props.sel.has(b.id)} selModo={props.selModo} onClick={() => props.onBloque(b)} onQuitar={() => props.onQuitar(b.id)} />
            ))}
        </div>
    );
}

function BloqueFranja({ b, sel, selModo, onClick, onQuitar }: { b: BloqueCalendario; sel: boolean; selModo: boolean; onClick: () => void; onQuitar: () => void }) {
    const top = (b.minInicio / 60 - H0) * PXH;
    const h = ((b.minFin - b.minInicio) / 60) * PXH;
    const estilos: Record<EstadoBloque, string> = {
        libre: `bg-cielo/15 border-cielo/55 text-cielo-700 ${sel ? "ring-2 ring-cielo" : ""}`,
        esperando: "bg-estado-ambar/20 border-estado-ambar text-estado-ambar",
        confirmada: "bg-pino border-pino text-white",
        validando: "bg-tinta/5 border-dashed border-tinta/25 text-muted",
        reservada: "bg-pino/80 border-pino text-white",
    };
    const etiqueta: Record<EstadoBloque, string> = {
        libre: b.modalidad === "VIRTUAL" ? "Virtual" : "Presencial",
        esperando: "Esperando su respuesta",
        confirmada: "Confirmada",
        validando: "Reservada · validando pago",
        reservada: "Reservada",
    };
    const accionable = b.estado === "libre" || b.estado === "esperando" || b.estado === "confirmada";
    return (
        <div
            data-franja={b.id}
            data-estado={b.estado}
            onClick={onClick}
            className={`group absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-[11px] ${estilos[b.estado]} ${accionable ? "cursor-pointer" : "cursor-default"}`}
            style={{ top, height: h }}
        >
            {b.estado === "libre" && !selModo && (
                <button aria-label={`Quitar la hora de ${fmt(b.minInicio)}`} className="absolute right-1 top-1 hidden rounded bg-tinta/15 p-0.5 group-hover:block" onClick={(e) => { e.stopPropagation(); onQuitar(); }}>
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
            <div className="font-mono text-[10px] font-semibold">{fmt(b.minInicio)}{b.estado === "libre" || b.estado === "esperando" ? `–${fmt(b.minFin)}` : ""}</div>
            <div className="opacity-90">{etiqueta[b.estado]}</div>
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
