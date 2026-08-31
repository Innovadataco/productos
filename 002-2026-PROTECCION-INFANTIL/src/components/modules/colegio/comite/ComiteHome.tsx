import Link from "next/link";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { fechaLargaES } from "@/lib/colegio/fechas-humano";
import type { ResumenComiteHomeDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    resumen: ResumenComiteHomeDto;
    nombreUsuario?: string;
}

// SPEC-319 §2.5: saludo por franja horaria (mismo criterio que HomeRectorPage).
function saludoSegunHora(hora: number): string {
    if (hora < 12) return "Buenos días";
    if (hora < 19) return "Buenas tardes";
    return "Buenas noches";
}

/**
 * SPEC-173 / SPEC-319 §2.5: inicio del rol COMITE_CONVIVENCIA como BANDEJA DE
 * TRABAJO (no panel de lectura). Prioriza lo urgente, cierra en verbos y tiene
 * empty state propio. Muestra SOLO metadatos de caso (número, categoría, estado,
 * fechas, SLA); nunca texto de reporte ni datos del denunciante.
 */
export function ComiteHome({ resumen, nombreUsuario }: Props) {
    const ahora = new Date();
    const urgentes = resumen.proximosVencerSla;
    const sinTrabajo = resumen.casosAbiertos === 0 && urgentes.length === 0;

    return (
        <div className="space-y-8">
            {/* §2.5.1: cabecera humana */}
            <header>
                <p className="text-lg font-semibold text-body">
                    {saludoSegunHora(ahora.getHours())}
                    {nombreUsuario ? `, ${nombreUsuario}` : ""}.
                </p>
                <p className="mt-0.5 text-sm text-muted">Hoy es {fechaLargaES(ahora)}.</p>
            </header>

            {sinTrabajo ? (
                // §2.5.5: empty state propio (no un tablero de ceros)
                <section className="rounded-2xl glass p-8 text-center md:p-12">
                    <h2 className="text-xl font-semibold text-body">Todo al día</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                        No hay casos escalados al comité en este momento. Cuando llegue uno nuevo, aparecerá acá
                        priorizado por urgencia.
                    </p>
                    <Link
                        href="/dashboard/colegio/comite/casos"
                        className="mt-6 inline-flex items-center justify-center rounded-xl border border-tinta/20 px-4 py-2 text-sm font-semibold text-body hover:bg-tinta/5"
                    >
                        Ver la gestión de casos
                    </Link>
                </section>
            ) : (
                <>
                    {/* §2.5.2: lo que apremia, primero y grande — lista accionable con el botón encima */}
                    <section className="rounded-2xl glass p-6 md:p-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2 className="text-xl font-semibold text-body">Lo que apremia</h2>
                            <span className="text-sm text-muted">
                                {urgentes.length === 0
                                    ? "Sin vencimientos en 24 h"
                                    : `${urgentes.length} ${urgentes.length === 1 ? "caso" : "casos"} vencido(s) o por vencer en 24 h`}
                            </span>
                        </div>
                        {urgentes.length === 0 ? (
                            <p className="mt-4 text-sm text-muted">
                                Ningún caso con SLA vencido o por vencer en las próximas 24 horas.
                            </p>
                        ) : (
                            <ul className="mt-4 divide-y divide-tinta/10">
                                {urgentes.map((caso) => (
                                    <li
                                        key={caso.id}
                                        className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p className="font-medium text-body">{caso.numero}</p>
                                            <p className="text-sm text-muted">
                                                {caso.categoria ?? "Sin categoría"} · {caso.estado}
                                                {caso.prioridad ? ` · prioridad ${caso.prioridad}` : ""}
                                            </p>
                                            <p className="text-sm text-muted">
                                                {caso.vencimientoSla
                                                    ? `Vence: ${new Date(caso.vencimientoSla).toLocaleString("es-CO", { timeZone: "America/Bogota" })}`
                                                    : "Sin fecha de vencimiento"}
                                            </p>
                                        </div>
                                        <Link
                                            href={`/dashboard/colegio/comite/casos/${caso.id}`}
                                            className="inline-flex items-center justify-center rounded-xl bg-pino px-4 py-2 text-sm font-semibold text-papel shadow hover:bg-pino/90"
                                        >
                                            Revisar y cerrar
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* §2.5.3: cifras con contexto (sub) */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TarjetaMetrica
                            label="Casos abiertos"
                            value={resumen.casosAbiertos}
                            sub={`${resumen.misCasosAsignados} asignado(s) a este comité`}
                        />
                        <TarjetaMetrica
                            label="Por vencer en 24 h"
                            value={urgentes.length}
                            sub={urgentes.length > 0 ? "requieren atención hoy" : "nada urgente ahora"}
                            tone={urgentes.length > 0 ? "up" : undefined}
                        />
                    </div>

                    {/* §2.5.4: cierra en verbos (acciones con propósito, no espejo del menú) */}
                    <div className="flex flex-wrap gap-3">
                        {urgentes.length > 0 && (
                            <Link
                                href={`/dashboard/colegio/comite/casos/${urgentes[0].id}`}
                                className="inline-flex items-center justify-center rounded-xl bg-pino px-4 py-2 text-sm font-semibold text-papel shadow hover:bg-pino/90"
                            >
                                Atender el más urgente
                            </Link>
                        )}
                        <Link
                            href="/dashboard/colegio/comite/casos"
                            className="inline-flex items-center justify-center rounded-xl border border-tinta/20 px-4 py-2 text-sm font-semibold text-body hover:bg-tinta/5"
                        >
                            Ver casos sin asignar
                        </Link>
                        <Link
                            href="/dashboard/colegio/comite/estadisticas"
                            className="inline-flex items-center justify-center rounded-xl border border-tinta/20 px-4 py-2 text-sm font-semibold text-body hover:bg-tinta/5"
                        >
                            Revisar estadísticas del mes
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
