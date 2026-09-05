import Link from "next/link";
import type { EmbudoTablero } from "@/lib/dal/repositories/colegio-resumen";

/**
 * SPEC-158 (T004, US1, FR-003) — El embudo: qué me espera a mí.
 * Cuatro cifras grandes (recibidos / cerrados / en revisión / te esperan a ti),
 * cada reporte contado UNA vez en el bucket de su estado más pendiente (sin
 * solapes, garantizado por `embudoPorReporte`). "Te esperan a ti" es el verbo del
 * tablero: si es > 0 se destaca con el estado rubí del sistema y enlaza a los
 * avisos del colegio; si es 0, copy positivo — la calma también se muestra (§4.0.1).
 */

interface EmbudoEstadoProps {
    embudo: EmbudoTablero;
    className?: string;
}

function CifraEmbudo({ etiqueta, valor }: { etiqueta: string; valor: number }) {
    return (
        <div className="rounded-2xl px-4 py-3">
            <p className="cifra text-4xl font-semibold text-body sm:text-5xl">{valor}</p>
            <p className="microetiqueta mt-2">{etiqueta}</p>
        </div>
    );
}

export function EmbudoEstado({ embudo, className = "" }: EmbudoEstadoProps) {
    const { recibidos, cerrados, enRevision, teEsperan } = embudo;
    const hayPendientes = teEsperan > 0;

    return (
        <section
            aria-label="Embudo de estado de los reportes"
            className={`glass rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}
        >
            <h2 className="titular-seccion text-body">El embudo de sus reportes</h2>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <CifraEmbudo etiqueta="Recibidos" valor={recibidos} />
                <CifraEmbudo etiqueta="Cerrados" valor={cerrados} />
                <CifraEmbudo etiqueta="En revisión" valor={enRevision} />
                <div
                    data-estado-esperan={hayPendientes ? "pendiente" : "al-dia"}
                    className={`rounded-2xl px-4 py-3 ${
                        hayPendientes ? "bg-rubi/10 ring-1 ring-rubi/40" : "bg-pino/10 ring-1 ring-pino/30"
                    }`}
                >
                    <p
                        className={`cifra text-4xl font-semibold sm:text-5xl ${
                            hayPendientes ? "text-estado-rubi" : "text-body"
                        }`}
                    >
                        {teEsperan}
                    </p>
                    <p className="microetiqueta mt-2">Te esperan a ti</p>
                </div>
            </div>

            {hayPendientes ? (
                <Link
                    href="/dashboard/colegio/alertas"
                    className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                >
                    Ver avisos nuevos →
                </Link>
            ) : (
                <p className="cuerpo mt-5 text-muted">Nada te espera — la vigilancia sigue activa.</p>
            )}
        </section>
    );
}
