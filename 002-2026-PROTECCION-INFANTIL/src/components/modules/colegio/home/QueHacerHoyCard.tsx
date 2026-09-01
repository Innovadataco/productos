import Link from "next/link";
import type { QueHacerHoy } from "@/lib/colegio/que-hacer-hoy";

/**
 * SPEC-353 (A-69 · C6 · mockup 2.1) — La frase accionable del puesto de mando.
 *
 * Caja ámbar SOLO cuando algo espera al rector; tono calmado (sin color de
 * alerta) cuando todo está al día. Una frase, una acción — los números viven
 * en el resto del tablero; acá hablan.
 */
export function QueHacerHoyCard({ frase }: { frase: QueHacerHoy }) {
    const esAmbar = frase.tono === "ambar";

    return (
        <section
            aria-label="Qué hacer hoy"
            data-testid="que-hacer-hoy"
            data-tono={frase.tono}
            className={`rounded-2xl border p-4 sm:p-5 ${
                esAmbar
                    ? "border-ambar/40 bg-ambar/10"
                    : "border-tinta/10 bg-papel/50 dark:bg-tinta/40"
            }`}
        >
            <div className="flex flex-wrap items-center gap-3">
                <h2 className={`flex-1 text-base font-semibold ${esAmbar ? "text-ambar" : "text-body"}`}>
                    {frase.titulo}
                </h2>
                <Link
                    href={frase.accionHref}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        esAmbar
                            ? "bg-ambar text-white"
                            : "border border-pino text-pino"
                    }`}
                >
                    {frase.accionTexto}
                </Link>
            </div>
            <p className="mt-1.5 text-sm text-body/80">{frase.detalle}</p>
        </section>
    );
}
