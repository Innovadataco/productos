import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ClientePage({ params }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const { id } = await params;
    const { suscripcion, pagos, eventos } = await new PagosRepository().obtenerFichaCliente(id);
    if (!suscripcion) notFound();

    const titular = suscripcion.colegio
        ? { tipo: "COLEGIO", nombre: suscripcion.colegio.nombre, email: suscripcion.usuario?.email ?? "—" }
        : suscripcion.usuario
            ? { tipo: "PADRE", nombre: suscripcion.usuario.nombre, email: suscripcion.usuario.email }
            : { tipo: "DESCONOCIDO", nombre: "—", email: "—" };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted">
                <Link href="/dashboard/admin/pagos/pendientes" className="hover:text-body">
                    Pagos
                </Link>
                <span>/</span>
                <span className="text-body">Ficha cliente</span>
            </div>

            <div className="rounded-xl border border-tinta/10 p-6 dark:border-tinta/20">
                <h2 className="text-xl font-bold text-body">{titular.nombre}</h2>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                        <span className="text-muted">Tipo:</span> <span className="font-medium">{titular.tipo}</span>
                    </div>
                    <div>
                        <span className="text-muted">Email:</span> <span className="font-medium">{titular.email}</span>
                    </div>
                    <div>
                        <span className="text-muted">Estado:</span>{" "}
                        <span className="font-medium">{suscripcion.estado}</span>
                    </div>
                    <div>
                        <span className="text-muted">Plan:</span>{" "}
                        <span className="font-medium">{suscripcion.planActual.nombre}</span>
                    </div>
                    <div>
                        <span className="text-muted">Vigencia:</span>{" "}
                        <span className="font-medium">
                            {new Date(suscripcion.fechaInicio).toLocaleDateString("es-CO")} —{" "}
                            {new Date(suscripcion.fechaFin).toLocaleDateString("es-CO")}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted">Moneda local:</span>{" "}
                        <span className="font-medium">{suscripcion.monedaLocal}</span>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="mb-3 text-lg font-semibold text-body">Pagos</h3>
                <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                    <table className="min-w-full text-sm">
                        <thead className="bg-tinta/5 dark:bg-tinta/10">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-muted">Estado</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Monto neto USD</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Monto local</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Método</th>
                                <th className="px-4 py-3 text-left font-medium text-muted">Fecha reporte</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                            {pagos.map((pago) => (
                                <tr key={pago.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                    <td className="px-4 py-3">{pago.estado}</td>
                                    <td className="px-4 py-3">${pago.montoNetoUSD.toFixed(2)}</td>
                                    <td className="px-4 py-3">
                                        {pago.monedaLocal} {pago.montoLocalPagado.toLocaleString("es-CO")}
                                    </td>
                                    <td className="px-4 py-3">{pago.metodoDeclarado}</td>
                                    <td className="px-4 py-3">{new Date(pago.fechaReporte).toLocaleDateString("es-CO")}</td>
                                </tr>
                            ))}
                            {pagos.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                                        No hay pagos registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div>
                <h3 className="mb-3 text-lg font-semibold text-body">Eventos recientes</h3>
                <div className="space-y-2">
                    {eventos.slice(0, 10).map((evento) => (
                        <div
                            key={evento.id}
                            className="rounded-lg border border-tinta/10 p-3 text-sm dark:border-tinta/20"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-body">{evento.accion}</span>
                                <span className="text-xs text-muted">
                                    {new Date(evento.creadoEn).toLocaleString("es-CO")}
                                </span>
                            </div>
                            <div className="mt-1 text-xs text-muted">{evento.tipoRecurso}</div>
                        </div>
                    ))}
                    {eventos.length === 0 && (
                        <p className="text-sm text-muted">No hay eventos registrados.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
