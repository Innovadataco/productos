import { BarChart } from "@/components/modules/BarChart";
import { WidgetSeccion } from "./WidgetSeccion";
import type { CrecimientoPaisCiudadDto } from "@/lib/pagos/analitica.service";

/**
 * SPEC-218 (002-PI-118) · Widget 4 (US-004/AS-004): crecimiento por país de
 * los últimos 6 meses (meses Bogotá) con alertas de cambio mes a mes >25%
 * (regla simple, sin IA — FR-010). Reutiliza el BarChart vivo de estadísticas
 * (FR-002). Muestra los 5 países de mayor volumen reciente.
 */
const MAX_PAISES = 5;

export function WidgetCrecimientoPaisCiudad({ data }: { data: CrecimientoPaisCiudadDto }) {
    const seriesVisibles = data.series.slice(0, MAX_PAISES);
    const alertas = data.series.filter((serie) => serie.alerta !== null);

    return (
        <WidgetSeccion titulo="Crecimiento por país" total={data.series.length}>
            {seriesVisibles.length === 0 ? (
                <p className="text-sm text-muted">No hay altas en los últimos 6 meses.</p>
            ) : (
                <div className="space-y-4">
                    {alertas.length > 0 && (
                        <ul className="space-y-2" aria-label="Alertas de crecimiento">
                            {alertas.map((serie) => (
                                <li
                                    key={serie.pais}
                                    role="alert"
                                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                                        serie.alerta === "crecimiento_alto"
                                            ? "border-pino/30 bg-pino/10 text-pino dark:border-pino/40 dark:bg-pino/20"
                                            : "border-rubi/30 bg-rubi/10 text-rubi dark:border-rubi/40 dark:bg-rubi/20"
                                    }`}
                                >
                                    {serie.pais}: {serie.variacionPct !== null && serie.variacionPct > 0 ? "+" : ""}
                                    {serie.variacionPct ?? "—"}% vs mes anterior (
                                    {serie.alerta === "crecimiento_alto" ? "crecimiento alto" : "caída fuerte"})
                                </li>
                            ))}
                        </ul>
                    )}
                    {seriesVisibles.map((serie) => (
                        <div key={serie.pais}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <p className="font-medium text-body">{serie.pais}</p>
                                <p className="text-xs text-muted">
                                    {serie.variacionPct === null
                                        ? "sin base de comparación"
                                        : `${serie.variacionPct > 0 ? "+" : ""}${serie.variacionPct}% vs mes anterior`}
                                </p>
                            </div>
                            <BarChart
                                data={data.labels.map((label, i) => ({ label, value: serie.data[i] ?? 0 }))}
                                ariaLabel={`Altas por mes en ${serie.pais}`}
                            />
                        </div>
                    ))}
                </div>
            )}
        </WidgetSeccion>
    );
}
