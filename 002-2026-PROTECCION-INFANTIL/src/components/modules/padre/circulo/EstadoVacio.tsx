"use client";

/**
 * A-73 (SPEC-367) · Estado vacío = PRIMER PASO.
 * No se muestra un vacío: se muestra qué hacer, con ideas concretas para que el
 * padre no tenga que pensar a quién poner.
 */
const PASOS = [
    { n: 1, titulo: "Agrega a la persona", detalle: "Su nombre y qué es de tus hijos." },
    { n: 2, titulo: "Escribe cómo la encuentran", detalle: "Su celular o su usuario en Instagram, TikTok, Roblox…" },
    { n: 3, titulo: "Nosotros la vigilamos", detalle: "Si aparece en un reporte, te escribimos al correo." },
] as const;

const IDEAS = ["El tío", "La niñera", "El entrenador", "Un vecino", "El profesor de música"] as const;

export function EstadoVacio({ onAgregar }: { onAgregar: () => void }) {
    return (
        <section className="mt-7 rounded-2xl border border-tinta/10 bg-white p-6 dark:bg-tinta/20">
            <h2 className="text-xl font-semibold text-body">Todavía no vigilas a nadie</h2>
            <p className="mt-1 text-muted">Empieza por quien más tiempo pasa con tus hijos.</p>

            <ol className="mt-5 grid gap-3 md:grid-cols-3">
                {PASOS.map((p) => (
                    <li key={p.n} className="flex gap-3 rounded-xl bg-papel p-3.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pino text-sm font-bold text-white">
                            {p.n}
                        </span>
                        <span>
                            <b className="block font-semibold text-body">{p.titulo}</b>
                            <span className="text-sm text-muted">{p.detalle}</span>
                        </span>
                    </li>
                ))}
            </ol>

            <div className="mt-6 flex flex-col gap-3">
                <button
                    type="button"
                    onClick={onAgregar}
                    className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-pino px-7 text-lg font-semibold text-white transition hover:brightness-110 sm:w-auto"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Agregar a la primera persona
                </button>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    Ideas:
                    {IDEAS.map((i) => (
                        <span key={i} className="rounded-full bg-papel px-2.5 py-1">
                            {i}
                        </span>
                    ))}
                </p>
            </div>

            <p className="mt-6 flex items-start gap-2 rounded-xl bg-pino/8 px-4 py-3 text-sm text-muted">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-pino" aria-hidden="true">
                    <path d="M12 3l7 3v6c0 4.5-3 8.3-7 9.5C8 20.3 5 16.5 5 12V6z" />
                </svg>
                <span>
                    <b className="font-semibold text-body">Solo tú ves tu círculo.</b> La persona no recibe ningún aviso
                    ni sabe que está aquí. Puedes quitarla cuando quieras.
                </span>
            </p>
        </section>
    );
}
