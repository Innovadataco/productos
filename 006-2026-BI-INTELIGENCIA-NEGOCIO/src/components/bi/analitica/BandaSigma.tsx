import type { AnaliticaData } from "@/lib/bi/analitica";
import CifraAnimada from "@/components/bi/pulso/CifraAnimada";
import { fmtMiles } from "@/components/bi/pulso/formatos";

/** "+2,3σ" / "-1,1σ" — solo formatea el sigma que ya viene resuelto (candado 10). */
function formatoSigma(sigma: number): string {
    const texto = Math.abs(sigma).toLocaleString("es-CO", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    return `${sigma >= 0 ? "+" : "-"}${texto}σ`;
}

/**
 * Banda sigma del día (mockup v4, sección 1): cómo va hoy frente a su propio
 * patrón de 28 días. Tres estados honestos (candado 9):
 * - sigma NULL → "sin base suficiente" (ni rubí ni pino: no sabemos).
 * - esAnomalo → banda rubí con punto latiendo.
 * - si no → banda pino, dentro de lo normal.
 * Las cifras (hoy, media 28 d, fenómenos) son las del contrato, jamás calculadas.
 */
export default function BandaSigma({
    anomalia,
    fenomenosActivos,
}: {
    anomalia: AnaliticaData["anomaliaHoy"];
    fenomenosActivos: number;
}) {
    const { sigma, totalHoy, media28d, esAnomalo } = anomalia;

    const banda =
        sigma === null ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--tinta-rgb)/0.14)] bg-[rgb(var(--tinta-rgb)/0.05)] px-4 py-2 text-sm font-bold text-muted">
                <span className="punto punto-warn" />
                Hoy aún sin base suficiente para comparar (se necesitan 28 días de histórico)
            </span>
        ) : esAnomalo ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--rubi-rgb)/0.4)] bg-[rgb(var(--rubi-rgb)/0.15)] px-4 py-2 text-sm font-bold text-estado-rubi">
                <span className="punto punto-bad anim-pulso" />
                Hoy está {formatoSigma(sigma)} por {sigma >= 0 ? "encima" : "debajo"} de lo normal
            </span>
        ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--pino-rgb)/0.4)] bg-[rgb(var(--pino-rgb)/0.14)] px-4 py-2 text-sm font-bold text-estado-pino">
                <span className="punto punto-ok" />
                Hoy dentro de lo normal ({formatoSigma(sigma)})
            </span>
        );

    return (
        <div
            className="anim-entrada mb-6 flex flex-wrap gap-2.5"
            style={{ "--anim-retardo": "60ms" } as React.CSSProperties}
        >
            {banda}
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)] px-3.5 py-1.5 text-[12.5px] font-medium">
                <span className="punto punto-ok" />
                Hoy: <b className="cifra font-semibold"><CifraAnimada valor={totalHoy} /></b>{" "}
                {totalHoy === 1 ? "reporte" : "reportes"}
                {media28d !== null && (
                    <span className="text-subtle"> · media 28 d: {fmtMiles(Math.round(media28d))}</span>
                )}
            </span>
            {fenomenosActivos > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)] px-3.5 py-1.5 text-[12.5px] font-medium">
                    <span className="punto punto-warn anim-pulso" />
                    {fenomenosActivos} {fenomenosActivos === 1 ? "fenómeno activo" : "fenómenos activos"} bajo
                    vigilancia
                </span>
            )}
        </div>
    );
}
