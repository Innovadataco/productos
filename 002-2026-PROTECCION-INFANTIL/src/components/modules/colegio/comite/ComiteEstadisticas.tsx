import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { Tooltip } from "@/components/ui/Tooltip";
import type { EstadisticasComiteDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    estadisticas: EstadisticasComiteDto;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
    PENDIENTE: "Pendientes",
    RESUELTA: "Resueltas",
};

/** "YYYY-MM-DD" → "DD/MM" sin tocar la zona horaria (la fecha ya viene en Bogotá). */
function etiquetaSemana(semanaInicio: string): string {
    return `${semanaInicio.slice(8, 10)}/${semanaInicio.slice(5, 7)}`;
}

/** "?" con tooltip criollo para explicar cada bloque sin saturar la página. */
function Ayuda({ texto, etiqueta }: { texto: string; etiqueta: string }) {
    return (
        <Tooltip content={texto}>
            <button
                type="button"
                aria-label={etiqueta}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-tinta/20 text-xs text-muted"
            >
                ?
            </button>
        </Tooltip>
    );
}

/**
 * SPEC-173: agregados de la bandeja del Comité de Convivencia. SOLO
 * estadísticas; nunca texto de reporte ni datos del denunciante.
 * SPEC-177: + tendencia semanal, cumplimiento del SLA, tiempo medio por
 * categoría y distribución por estado con porcentaje.
 */
export function ComiteEstadisticas({ estadisticas }: Props) {
    const { distribucionEstado, tendenciaSemanal, sla, tiempoMedioPorCategoria } = estadisticas;
    const totalCasos = distribucionEstado.reduce((acc, fila) => acc + fila.total, 0);
    const maximoSemanal = Math.max(1, ...tendenciaSemanal.flatMap((s) => [s.creados, s.resueltos]));
    const maximoDiasCategoria = Math.max(1, ...tiempoMedioPorCategoria.map((fila) => fila.dias));

    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
                <TarjetaMetrica label="Casos totales" value={totalCasos} />
                <TarjetaMetrica
                    label="Tiempo medio de resolución"
                    value={estadisticas.tiempoMedioResolucionDias ?? "—"}
                    suffix={estadisticas.tiempoMedioResolucionDias !== null ? " días" : ""}
                />
                <TarjetaMetrica label="Categorías distintas" value={estadisticas.topCategorias.length} />
            </div>

            <section className="rounded-2xl glass p-6 md:p-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-body">Tendencia semanal</h2>
                    <Ayuda
                        etiqueta="Qué muestra la tendencia semanal"
                        texto="Tendencia = casos nuevos y casos resueltos en cada semana (últimas 8 semanas)"
                    />
                </div>
                <div className="mt-6 flex items-end gap-2">
                    {tendenciaSemanal.map((semana) => (
                        <div key={semana.semanaInicio} className="flex flex-1 flex-col items-center gap-1">
                            <div className="flex h-24 items-end gap-1">
                                <div
                                    className="w-3 rounded-t bg-tinta/30"
                                    style={{ height: `${(semana.creados / maximoSemanal) * 100}%` }}
                                    title={`${semana.creados} nuevos`}
                                />
                                <div
                                    className="w-3 rounded-t bg-pino/60"
                                    style={{ height: `${(semana.resueltos / maximoSemanal) * 100}%` }}
                                    title={`${semana.resueltos} resueltos`}
                                />
                            </div>
                            <span className="text-[10px] text-subtle">{etiquetaSemana(semana.semanaInicio)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-tinta/30" /> Nuevos
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-pino/60" /> Resueltos
                    </span>
                </div>
            </section>

            <section className="rounded-2xl glass p-6 md:p-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-body">Cumplimiento del SLA</h2>
                    <Ayuda
                        etiqueta="Qué significa a tiempo"
                        texto="A tiempo = resuelto antes de su fecha límite. Vencidos = resueltos tarde o aún abiertos con la fecha ya pasada."
                    />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-pino/10 p-4 ring-1 ring-pino/30">
                        <p className="text-2xl font-bold text-body">{sla.aTiempo}</p>
                        <p className="mt-1 text-xs text-muted">A tiempo</p>
                    </div>
                    <div className="rounded-xl bg-rubi/10 p-4 ring-1 ring-rubi/40">
                        <p className="text-2xl font-bold text-body">{sla.vencidos}</p>
                        <p className="mt-1 text-xs text-muted">Vencidos</p>
                    </div>
                    <div className="rounded-xl bg-tinta/5 p-4 ring-1 ring-tinta/15">
                        <p className="text-2xl font-bold text-body">{sla.sinSla}</p>
                        <p className="mt-1 text-xs text-muted">Sin fecha límite</p>
                    </div>
                </div>
                <p className="mt-4 text-sm text-muted">
                    {sla.pctATiempo === null
                        ? "Todavía no hay casos con fecha límite para medir el cumplimiento."
                        : `${sla.pctATiempo}% de los casos con fecha límite se resolvieron a tiempo.`}
                </p>
            </section>

            <section className="rounded-2xl glass p-6 md:p-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-body">Tiempo medio por categoría</h2>
                    <Ayuda
                        etiqueta="Qué es el tiempo medio por categoría"
                        texto="Tiempo medio = días promedio desde que el caso llega al comité hasta que se resuelve"
                    />
                </div>
                {tiempoMedioPorCategoria.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Todavía no hay casos resueltos.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {tiempoMedioPorCategoria.map((fila) => (
                            <li key={fila.categoria}>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-body">{fila.categoria}</span>
                                    <span className="font-semibold text-body">
                                        {fila.dias} días · {fila.resueltos} {fila.resueltos === 1 ? "resuelto" : "resueltos"}
                                    </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-tinta/10">
                                    <div
                                        className="h-2 rounded-full bg-ambar/60"
                                        style={{ width: `${(fila.dias / maximoDiasCategoria) * 100}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl glass p-6 md:p-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-body">Casos por estado</h2>
                    <Ayuda
                        etiqueta="Qué es la distribución por estado"
                        texto="Distribución = qué parte del total de casos está en cada estado"
                    />
                </div>
                {distribucionEstado.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Todavía no hay casos escalados.</p>
                ) : (
                    <ul className="mt-4 space-y-3">
                        {distribucionEstado.map((fila) => (
                            <li key={fila.estado}>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-body">{ETIQUETAS_ESTADO[fila.estado] ?? fila.estado}</span>
                                    <span className="font-semibold text-body">
                                        {fila.total} · {fila.pct}%
                                    </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-tinta/10">
                                    <div className="h-2 rounded-full bg-pino/50" style={{ width: `${fila.pct}%` }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl glass p-6 md:p-8">
                <h2 className="text-xl font-semibold text-body">Categorías más frecuentes</h2>
                {estadisticas.topCategorias.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Todavía no hay casos clasificados.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-tinta/10">
                        {estadisticas.topCategorias.map((categoria) => (
                            <li key={categoria.categoria} className="flex items-center justify-between py-3">
                                <span className="text-sm text-body">{categoria.categoria}</span>
                                <span className="text-sm font-semibold text-body">{categoria.total}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
