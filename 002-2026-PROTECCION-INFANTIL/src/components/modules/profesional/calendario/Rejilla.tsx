"use client";

/**
 * SPEC-714/730 · Piezas del calendario ESPECÍFICAS del profesional: el bloque de una
 * franja con su estado (libre/esperando/confirmada/validando/reservada) y sus acciones
 * (quitar), y los overlays de la columna (muro de vigencia SPEC-449 · día bloqueado
 * SPEC-714). La geometría y el armazón de la cuadrícula viven en la rejilla COMPARTIDA
 * (`components/modules/calendario/Rejilla`); acá queda solo lo que es del profesional y
 * su voz «usted» (por eso sigue bajo `profesional/`, donde el candado de voz lo cubre).
 */
import type { BloqueCalendario, EstadoBloque } from "@/lib/profesional/calendario/calendario.service";
import { H0, PXH, estiloBloque, fmt } from "@/components/modules/calendario/fechas";

/** Overlays de la columna de un día: día cerrado (rayado ámbar) + muro de vigencia. */
export function OverlayDiaProfesional({
    fecha,
    muro,
    bloqueado,
    altura,
}: {
    fecha: string;
    muro: { fecha: string; minuto: number } | null;
    bloqueado: boolean;
    altura: number;
}) {
    // Muro de vigencia: y (px) donde empieza la zona rayada en este día. Comparación pura
    // contra el muro que ya proyectó el servidor a Bogotá — sin zona horaria acá.
    let muroTop: number | null = null;
    if (muro) {
        if (fecha > muro.fecha) muroTop = 0; // día entero fuera de vigencia
        else if (fecha === muro.fecha) muroTop = Math.max(0, (muro.minuto / 60 - H0) * PXH);
    }
    return (
        <>
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
        </>
    );
}

export function BloqueFranja({ b, sel, selModo, onClick, onQuitar }: { b: BloqueCalendario; sel: boolean; selModo: boolean; onClick: () => void; onQuitar: () => void }) {
    const { top, height } = estiloBloque(b.minInicio, b.minFin);
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
            style={{ top, height }}
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
