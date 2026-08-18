import Link from "next/link";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import type { ResumenComiteHomeDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    resumen: ResumenComiteHomeDto;
}

/**
 * SPEC-173: home del rol COMITE_CONVIVENCIA. Muestra SOLO metadatos de caso
 * (número, categoría, estado, fechas, SLA); nunca texto de reporte ni datos
 * del denunciante.
 */
export function ComiteHome({ resumen }: Props) {
    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
                <TarjetaMetrica label="Casos abiertos" value={resumen.casosAbiertos} />
                <TarjetaMetrica label="Mis casos asignados" value={resumen.misCasosAsignados} />
                <TarjetaMetrica
                    label="Próximos a vencer SLA"
                    value={resumen.proximosVencerSla.length}
                    tone={resumen.proximosVencerSla.length > 0 ? "up" : undefined}
                />
            </div>

            <section className="rounded-2xl glass p-6 md:p-8">
                <h2 className="text-xl font-semibold text-body">Próximos a vencer SLA</h2>
                {resumen.proximosVencerSla.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No hay casos con SLA vencido o por vencer en 24 horas.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-tinta/10">
                        {resumen.proximosVencerSla.map((caso) => (
                            <li
                                key={caso.id}
                                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <p className="font-medium text-body">{caso.numero}</p>
                                    <p className="text-sm text-muted">
                                        {caso.categoria ?? "Sin categoría"} · {caso.estado}
                                        {caso.prioridad ? ` · prioridad ${caso.prioridad}` : ""}
                                    </p>
                                    <p className="text-sm text-muted">
                                        {caso.vencimientoSla
                                            ? `Vence: ${new Date(caso.vencimientoSla).toLocaleString("es-CO")}`
                                            : "Sin fecha de vencimiento"}
                                    </p>
                                </div>
                                <Link
                                    href={`/dashboard/colegio/comite/casos/${caso.id}`}
                                    className="inline-flex items-center justify-center rounded-xl bg-pino px-4 py-2 text-sm font-semibold text-papel shadow hover:bg-pino/90"
                                >
                                    Ver caso
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="flex flex-wrap gap-3">
                <Link
                    href="/dashboard/colegio/comite/casos"
                    className="inline-flex items-center justify-center rounded-xl bg-pino px-4 py-2 text-sm font-semibold text-papel shadow hover:bg-pino/90"
                >
                    Ver bandeja de casos
                </Link>
                <Link
                    href="/dashboard/colegio/comite/estadisticas"
                    className="inline-flex items-center justify-center rounded-xl border border-tinta/20 px-4 py-2 text-sm font-semibold text-body hover:bg-tinta/5"
                >
                    Ver estadísticas
                </Link>
            </div>
        </div>
    );
}
