/**
 * SPEC-658 (I-393) · pantalla de admin: citas pagadas sin respuesta del profesional.
 * Forma y copy: Diseño, FORMA-SPEC658 (12-09-2026). Voz usted (interno, D-107).
 *
 * VE, no EJECUTA (I-397): ningún botón que mueva dinero. Muestra dos hechos de un
 * vistazo —hubo PAGO y hubo SILENCIO del profesional— para que un admin decida si
 * devuelve; el monto va como DATO, sin pre-decidir cuánto. La asimetría de D-137 la
 * sostiene la consulta (solo VENCIDA_SIN_RESPUESTA) y la refuerza la nota fija.
 */
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

const HORAS_SILENCIO = 48;
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
function fecha(d: Date): string {
    return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function CitasPagadasSinRespuestaPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const items = await new SolicitudCitaRepository().listarVencidasConPagoParaAdmin();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Citas pagadas sin respuesta del profesional</h2>
                <span className="text-sm text-muted">{items.length} caso(s)</span>
            </div>

            {/* La regla, escrita en la pantalla (FORMA-SPEC658 · asimetría D-137). */}
            <p className="rounded-xl bg-ambar/10 px-4 py-3 text-sm text-estado-ambar">
                Aquí solo hay citas donde el profesional no respondió. El no-asistió del padre no se
                devuelve y no aparece en esta lista.
            </p>

            {items.length === 0 ? (
                <p className="rounded-xl border border-tinta/10 px-4 py-8 text-center text-muted dark:border-tinta/20">
                    No hay citas pagadas sin respuesta del profesional.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                    <table className="min-w-full text-sm">
                        <thead className="bg-tinta/5 dark:bg-tinta/10">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted">Padre</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Profesional</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Pagó</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Situación</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Cita</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                            {items.map((c) => {
                                const silencioDesde = c.pagoAprobadoEn
                                    ? new Date(new Date(c.pagoAprobadoEn).getTime() + HORAS_SILENCIO * 60 * 60 * 1000)
                                    : null;
                                return (
                                    <tr key={c.id} className="align-top hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-body">{c.padreUsuario?.nombre ?? "—"}</div>
                                            <div className="text-xs text-muted">{c.padreUsuario?.email ?? ""}</div>
                                        </td>
                                        <td className="px-4 py-3 text-body">{c.profesional?.nombreVisible ?? "—"}</td>
                                        {/* HECHO 1 · hubo PAGO: monto prominente + cuándo se aprobó + desglose (dato). */}
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-body">{COP.format(c.montoTotal)}</div>
                                            <div className="text-xs text-muted">
                                                Pago aprobado el {c.pagoAprobadoEn ? fecha(c.pagoAprobadoEn) : "—"}
                                            </div>
                                            <div className="text-xs text-muted">
                                                consulta {COP.format(c.montoConsulta)} · servicio {COP.format(c.montoServicio)}
                                            </div>
                                        </td>
                                        {/* HECHO 2 · SILENCIO del profesional: badge ámbar con texto (nunca color solo). */}
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar/10 px-2.5 py-0.5 text-xs font-medium text-estado-ambar">
                                                El profesional no respondió (48 h)
                                            </span>
                                            {silencioDesde && (
                                                <div className="mt-1 text-xs text-muted">Sin respuesta desde {fecha(silencioDesde)}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted">
                                            {c.franja ? `${fecha(c.franja.inicio)} · ${c.franja.modalidad}` : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
