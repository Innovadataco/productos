"use client";

/**
 * SPEC-730 · Barra de navegación NEUTRA de la rejilla: rango + ‹ Hoy › + Día/Semana.
 * Sin voz de audiencia (vive fuera de `profesional/` y `padre/`). El título lo pone
 * quien la usa (el padre: «Elige un horario» / «Mis citas»).
 */
import type { VistaCalendario } from "./useCalendarioNav";

export function NavCalendario({
    rango,
    vista,
    onVista,
    onAnterior,
    onSiguiente,
    onHoy,
}: {
    rango: string;
    vista: VistaCalendario;
    onVista: (v: VistaCalendario) => void;
    onAnterior: () => void;
    onSiguiente: () => void;
    onHoy: () => void;
}) {
    return (
        <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{rango}</span>
            <div className="ml-auto flex items-center gap-2">
                <button type="button" aria-label="Ir al período anterior" className="rounded-lg border border-tinta/10 px-2 py-1 text-muted hover:text-body" onClick={onAnterior}>‹</button>
                <button type="button" className="rounded-lg border border-tinta/10 px-3 py-1 text-xs font-semibold text-muted hover:text-body" onClick={onHoy}>Hoy</button>
                <button type="button" aria-label="Ir al período siguiente" className="rounded-lg border border-tinta/10 px-2 py-1 text-muted hover:text-body" onClick={onSiguiente}>›</button>
                <div className="inline-flex rounded-lg bg-tinta/5 p-0.5">
                    <button type="button" aria-pressed={vista === "dia"} className={`rounded-md px-3 py-1 text-xs font-semibold ${vista === "dia" ? "bg-page text-body shadow-sm" : "text-muted"}`} onClick={() => onVista("dia")}>Día</button>
                    <button type="button" aria-pressed={vista === "semana"} className={`rounded-md px-3 py-1 text-xs font-semibold ${vista === "semana" ? "bg-page text-body shadow-sm" : "text-muted"}`} onClick={() => onVista("semana")}>Semana</button>
                </div>
            </div>
        </div>
    );
}
