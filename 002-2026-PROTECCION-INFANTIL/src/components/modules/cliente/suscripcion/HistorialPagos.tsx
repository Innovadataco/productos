import { GlassCard } from "@/components/ui/GlassCard";
import { fechaCorta } from "@/lib/format/fecha";
import type { PagoHistorialItem } from "@/lib/pagos/suscripcion-vista.types";
import { estadoPagoMeta, formatoLocal, DURACION_LABEL, METODO_PAGO_LABEL } from "./util";

/**
 * SPEC-211 (002-PI-111): bloque 3 — historial de pagos de la suscripción.
 * Componente puro (sin fetch): recibe los items del DTO.
 */
export function HistorialPagos({ pagos, monedaLocal }: { pagos: PagoHistorialItem[]; monedaLocal: string }) {
    return (
        <GlassCard data-testid="bloque-historial" className="p-6">
            <h2 className="text-lg font-bold text-body">Historial de pagos</h2>
            {pagos.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Aún no hay pagos registrados para esta suscripción.</p>
            ) : (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                        <thead>
                            <tr className="border-b border-tinta/10 text-xs uppercase tracking-wide text-subtle">
                                <th className="py-2 pr-4 font-medium">Fecha</th>
                                <th className="py-2 pr-4 font-medium">Periodo</th>
                                <th className="py-2 pr-4 font-medium">Método</th>
                                <th className="py-2 pr-4 font-medium">Monto</th>
                                <th className="py-2 pr-4 font-medium">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map((pago) => {
                                const meta = estadoPagoMeta(pago.estado);
                                return (
                                    <tr key={pago.id} className="border-b border-tinta/5 last:border-0">
                                        <td className="py-3 pr-4 text-body">{fechaCorta(pago.fechaReporte)}</td>
                                        <td className="py-3 pr-4 text-muted">
                                            {DURACION_LABEL[pago.duracionCubierta] ?? pago.duracionCubierta}
                                        </td>
                                        <td className="py-3 pr-4 text-muted">
                                            {METODO_PAGO_LABEL[pago.metodoDeclarado] ?? pago.metodoDeclarado}
                                        </td>
                                        <td className="py-3 pr-4 text-body">
                                            {formatoLocal(pago.montoLocalPagado, pago.monedaLocal || monedaLocal)}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.clases}`}
                                                title={pago.motivoRechazo ?? undefined}
                                            >
                                                {meta.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </GlassCard>
    );
}
