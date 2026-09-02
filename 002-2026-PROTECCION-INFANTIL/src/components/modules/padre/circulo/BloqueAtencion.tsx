"use client";

/**
 * A-73 (SPEC-367) · "Necesita tu atención": lo que apremia, primero.
 * Solo aparece cuando hay algo. Ámbar, nunca rojo.
 */
import { nombreVisible, type Contacto } from "./tipos";

export function BloqueAtencion({
    personas,
    onVer,
}: {
    personas: Contacto[];
    onVer: (contacto: Contacto) => void;
}) {
    const primera = personas[0];
    if (!primera) return null;

    const nombre = nombreVisible(primera);
    const dato = primera.identificadores.find((i) => i.activo) ?? primera.identificadores[0];

    return (
        <div className="mt-4 grid gap-3.5 rounded-2xl border border-ambar/40 bg-ambar/8 p-4 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-5 md:p-5">
            <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-ambar/15 ring-2 ring-ambar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-ambar">
                    <path d="M12 4l9 15.5H3z" />
                    <path d="M12 10v4M12 17v.1" />
                </svg>
            </span>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ambar">Necesita tu atención</p>
                <p className="mt-0.5 text-lg font-semibold text-body">
                    {personas.length === 1
                        ? `Alguien reportó a ${nombre}`
                        : `Hay reportes sobre ${personas.length} personas de tu círculo`}
                </p>
                <p className="mt-1 text-sm text-muted">
                    {dato && (
                        <>
                            Su dato <b className="font-semibold text-body">{dato.valor}</b>
                            {dato.plataforma ? ` en ${dato.plataforma.nombre}` : ""} apareció en un reporte.{" "}
                        </>
                    )}
                    Míralo con calma: ahí te contamos de qué se trata.
                </p>
            </div>
            <button
                type="button"
                onClick={() => onVer(primera)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-pino px-5 font-semibold text-white transition hover:brightness-110"
            >
                Ver de qué se trata
            </button>
        </div>
    );
}
