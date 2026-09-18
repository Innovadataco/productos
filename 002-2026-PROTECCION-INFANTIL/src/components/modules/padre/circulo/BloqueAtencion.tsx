"use client";

/**
 * A-73 (SPEC-367) · "Necesita tu atención": lo que apremia, primero.
 * Solo aparece cuando hay algo. Ámbar, nunca rojo.
 *
 * SPEC-718 (Jelkin probando 18-09): el bloque afirmaba «Hay reportes sobre N personas» pero
 * mostraba UNA sola línea (la de `personas[0]`) y un botón «Ver de qué se trata» que abría solo
 * a esa primera — el número prometía más de lo que la pantalla mostraba. Forma fijada por Jelkin:
 *  · UNA LÍNEA POR PERSONA (cada una con su dato + plataforma), no la de la primera repetida.
 *  · SIN botón: es redundante (cada tarjeta de abajo ya tiene el suyo); la salida es la tarjeta.
 *  · Con una sola persona, queda como antes (título «Alguien reportó a X» + su línea), sin botón.
 * El texto exacto de las líneas lo afina Diseño; la forma (una por persona) es de Jelkin.
 */
import { nombreVisible, type Contacto } from "./tipos";

export function BloqueAtencion({ personas }: { personas: Contacto[] }) {
    if (personas.length === 0) return null;
    const unaSola = personas.length === 1;

    return (
        <div className="mt-4 grid gap-3.5 rounded-2xl border border-ambar/40 bg-ambar/8 p-4 md:grid-cols-[auto_1fr] md:items-start md:gap-5 md:p-5">
            <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-ambar/15 ring-2 ring-ambar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-ambar">
                    <path d="M12 4l9 15.5H3z" />
                    <path d="M12 10v4M12 17v.1" />
                </svg>
            </span>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ambar">Necesita tu atención</p>
                <p className="mt-0.5 text-lg font-semibold text-body">
                    {unaSola
                        ? `Alguien reportó a ${nombreVisible(personas[0]!)}`
                        : `Hay reportes sobre ${personas.length} personas de tu círculo`}
                </p>
                {/* SPEC-718: una línea POR PERSONA — la cuenta del título no puede prometer más
                    personas que líneas mostradas (candado). */}
                <ul className="mt-1 space-y-1">
                    {personas.map((persona) => {
                        const dato = persona.identificadores.find((i) => i.activo) ?? persona.identificadores[0];
                        return (
                            <li key={persona.id} className="text-sm text-muted">
                                {dato ? (
                                    <>
                                        Su dato <b className="font-semibold text-body">{dato.valor}</b>
                                        {dato.plataforma ? ` en ${dato.plataforma.nombre}` : ""} apareció en un reporte.
                                    </>
                                ) : (
                                    <>Apareció en un reporte.</>
                                )}
                            </li>
                        );
                    })}
                </ul>
                <p className="mt-1 text-sm text-muted">Míralo con calma: ahí te contamos de qué se trata.</p>
            </div>
        </div>
    );
}
