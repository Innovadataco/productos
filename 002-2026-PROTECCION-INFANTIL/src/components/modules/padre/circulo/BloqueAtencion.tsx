"use client";

/**
 * A-73 (SPEC-367) · "Necesita tu atención": lo que apremia, primero.
 * Solo aparece cuando hay algo. Ámbar, nunca rojo.
 *
 * SPEC-718 (Jelkin probando 18-09 · FORMA-SPEC718 de Diseño): el bloque afirmaba «Hay reportes
 * sobre N personas» pero mostraba UNA sola línea (`personas[0]`) y un botón «Ver de qué se trata»
 * que abría solo a esa primera — el número prometía más de lo que la pantalla mostraba. Forma:
 *  · UNA LÍNEA POR PERSONA (con 2+ cada línea NOMBRA a quién: el título es genérico); con 1 queda
 *    como antes («Su dato … apareció en un reporte», sin nombre porque el título ya la nombra).
 *  · SIN botón: es redundante (cada tarjeta ya tiene el suyo); el bloque RESUME, la tarjeta ABRE.
 *  · Corte en 4 líneas: de 5 en adelante, 4 líneas + una línea de cierre de lista, y el título dice
 *    «varias» (SIN número) — así el bloque NUNCA afirma más personas de las que lista (el candado).
 *    El conteo exacto vive en las tarjetas de abajo, no en el resumen.
 */
import { nombreVisible, type Contacto } from "./tipos";

/** Diseño §4: hasta 4 líneas; el 4 es ajustable, la regla es «afirmado ≤ líneas mostradas». */
const MAX_LINEAS = 4;

export function BloqueAtencion({ personas }: { personas: Contacto[] }) {
    if (personas.length === 0) return null;
    const total = personas.length;
    const mostradas = personas.slice(0, MAX_LINEAS);
    const hayMas = total > MAX_LINEAS;
    // Con 2+ el título es genérico, así que cada línea nombra a quién. Con 1 el título ya la nombra.
    const conNombre = total > 1;

    const titulo =
        total === 1
            ? `Alguien reportó a ${nombreVisible(personas[0]!)}`
            : hayMas
                ? "Hay reportes sobre varias personas de tu círculo"
                : `Hay reportes sobre ${total} personas de tu círculo`;

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
                <p className="mt-0.5 text-lg font-semibold text-body">{titulo}</p>
                {/* SPEC-718: una línea POR PERSONA (hasta MAX_LINEAS) — la cuenta del título no puede
                    prometer más personas que líneas mostradas (candado). */}
                <ul className="mt-1 space-y-1">
                    {mostradas.map((persona) => {
                        const dato = persona.identificadores.find((i) => i.activo) ?? persona.identificadores[0];
                        return (
                            <li key={persona.id} className="text-sm text-muted">
                                {conNombre ? (
                                    <>
                                        <b className="font-semibold text-body">{nombreVisible(persona)}</b>: su dato{" "}
                                    </>
                                ) : (
                                    "Su dato "
                                )}
                                <b className="font-semibold text-body">{dato?.valor ?? ""}</b>
                                {dato?.plataforma ? ` en ${dato.plataforma.nombre}` : ""} apareció en un reporte.
                            </li>
                        );
                    })}
                </ul>
                {/* Diseño §4: con 5+ no se dice «y N más» (repetiría el defecto: número > lo mostrado);
                    el total vive en las tarjetas de abajo, una por una. */}
                {hayMas && (
                    <p className="mt-1 text-sm text-muted">
                        Y otras personas de tu círculo también tienen reportes — están abajo, cada una en su tarjeta.
                    </p>
                )}
                <p className="mt-1 text-sm text-muted">
                    Míralo con calma: en la tarjeta de cada persona te contamos de qué se trata.
                </p>
            </div>
        </div>
    );
}
