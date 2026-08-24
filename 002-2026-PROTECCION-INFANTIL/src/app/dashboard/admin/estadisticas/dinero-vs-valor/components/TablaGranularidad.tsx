"use client";

/**
 * SPEC-222 (002-PI-123, US-3): tabla de agregados por granularidad con
 * semáforo de variación y drill-down (click en fila). Las 7 granularidades se
 * eligen con los botones superiores; el breadcrumb refleja el nivel activo.
 * Lenguaje descriptivo/estadístico (presunción de inocencia): los scores son
 * métricas de uso comercial, nunca calificaciones de personas.
 */
import { BreadcrumbDrill } from "./BreadcrumbDrill";
import type { DineroVsValorRespuesta, FilaGranularidad, Granularidad, Semaforo } from "./tipos";

const GRANULARIDADES: { clave: Granularidad; etiqueta: string }[] = [
    { clave: "pais", etiqueta: "País" },
    { clave: "ciudad", etiqueta: "Ciudad" },
    { clave: "colegio", etiqueta: "Colegio" },
    { clave: "padre", etiqueta: "Padre" },
    { clave: "plan", etiqueta: "Plan" },
    { clave: "cohorte", etiqueta: "Cohorte" },
    { clave: "canal", etiqueta: "Canal" },
];

const CLASE_SEMAFORO: Record<Semaforo, string> = {
    pino: "bg-pino",
    ambar: "bg-ambar",
    rubi: "bg-rubi",
};

function formatoVariacion(variacion: number | null): string {
    if (variacion === null) return "—";
    const signo = variacion >= 0 ? "+" : "";
    return `${signo}${variacion.toFixed(1)}%`;
}

export function TablaGranularidad({
    data,
    granularidad,
    onCambiarGranularidad,
    onNavegarFila,
    onBreadcrumb,
    onPagina,
}: {
    data: DineroVsValorRespuesta;
    granularidad: Granularidad;
    onCambiarGranularidad: (g: Granularidad) => void;
    onNavegarFila: (fila: FilaGranularidad) => void;
    onBreadcrumb: (accion: "todos" | "pais" | "ciudad") => void;
    onPagina: (page: number) => void;
}) {
    const { pagination } = data;
    return (
        <section className="glass rounded-3xl p-6" aria-label="Agregados por granularidad">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-body">Dónde invertir y dónde intervenir</h2>
                    <BreadcrumbDrill niveles={data.breadcrumb} onNavegar={onBreadcrumb} />
                </div>
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Granularidad">
                    {GRANULARIDADES.map((g) => (
                        <button
                            key={g.clave}
                            type="button"
                            role="tab"
                            aria-selected={granularidad === g.clave}
                            onClick={() => onCambiarGranularidad(g.clave)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                granularidad === g.clave
                                    ? "bg-pino text-white shadow"
                                    : "text-muted hover:bg-tinta/10 hover:text-body"
                            }`}
                        >
                            {g.etiqueta}
                        </button>
                    ))}
                </div>
            </div>

            {data.items.length === 0 ? (
                <p className="rounded-xl border border-tinta/10 p-4 text-sm text-muted">
                    Sin datos para esta granularidad en el período seleccionado.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-tinta/10 text-left text-xs text-muted">
                                <th className="py-2 pr-3 font-medium">Nombre</th>
                                <th className="py-2 pr-3 font-medium">Clientes</th>
                                <th className="py-2 pr-3 font-medium">Recaudo (USD)</th>
                                <th className="py-2 pr-3 font-medium">Score prom.</th>
                                {granularidad === "cohorte" && <th className="py-2 pr-3 font-medium">Retenidos</th>}
                                {granularidad === "plan" && <th className="py-2 pr-3 font-medium">Renovación</th>}
                                <th className="py-2 pr-3 font-medium">Variación</th>
                                <th className="py-2 font-medium">Semáforo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map((fila) => {
                                const navegable = fila.drill !== null || fila.suscripcionId !== null;
                                return (
                                    <tr
                                        key={fila.clave}
                                        className={`border-b border-tinta/5 ${navegable ? "cursor-pointer hover:bg-tinta/5" : ""}`}
                                        onClick={() => navegable && onNavegarFila(fila)}
                                    >
                                        <td className="py-2.5 pr-3 font-medium text-body">
                                            {fila.etiqueta}
                                            {navegable && <span className="ml-1 text-xs text-muted">→</span>}
                                        </td>
                                        <td className="py-2.5 pr-3 text-muted">{fila.suscripciones}</td>
                                        <td className="py-2.5 pr-3 text-body">${fila.recaudoUSD.toLocaleString("es-CO")}</td>
                                        <td className="py-2.5 pr-3 text-muted">{fila.scorePromedio ?? "—"}</td>
                                        {granularidad === "cohorte" && (
                                            <td className="py-2.5 pr-3 text-muted">{fila.retenidosPct ?? 0}%</td>
                                        )}
                                        {granularidad === "plan" && (
                                            <td className="py-2.5 pr-3 text-muted">{fila.renovacionPct ?? 0}%</td>
                                        )}
                                        <td className="py-2.5 pr-3 text-muted">{formatoVariacion(fila.variacionRecaudoPct)}</td>
                                        <td className="py-2.5">
                                            <span
                                                className={`inline-block h-3 w-3 rounded-full ${CLASE_SEMAFORO[fila.semaforo]}`}
                                                title={`Semáforo ${fila.semaforo}`}
                                                aria-label={`Semáforo ${fila.semaforo}`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                <span>
                    Total: {data.totales.suscripciones} clientes · ${data.totales.recaudoUSD.toLocaleString("es-CO")} USD
                    {data.totales.sinScore > 0 && ` · ${data.totales.sinScore} sin score calculado`}
                </span>
                {pagination.totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={pagination.page <= 1}
                            onClick={() => onPagina(pagination.page - 1)}
                            className="rounded-lg border border-tinta/20 px-3 py-1.5 font-medium transition hover:bg-tinta/5 disabled:opacity-40"
                        >
                            Anterior
                        </button>
                        <span>
                            Página {pagination.page} de {pagination.totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => onPagina(pagination.page + 1)}
                            className="rounded-lg border border-tinta/20 px-3 py-1.5 font-medium transition hover:bg-tinta/5 disabled:opacity-40"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
