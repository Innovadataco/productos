import Link from "next/link";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}

function clienteNombre(pago: Awaited<ReturnType<PagosRepository["listarPagosPendientes"]>>["items"][number]) {
    if (pago.suscripcion.usuario) {
        return { tipo: "PADRE", nombre: pago.suscripcion.usuario.nombre ?? "—", email: pago.suscripcion.usuario.email };
    }
    if (pago.suscripcion.colegio) {
        return { tipo: "COLEGIO", nombre: pago.suscripcion.colegio.nombre, email: "—" };
    }
    return { tipo: "DESCONOCIDO", nombre: "—", email: "—" };
}

export default async function PendientesPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    const q = params.q?.trim();

    const { items, total } = await new PagosRepository().listarPagosPendientes(
        { q },
        { skip: (page - 1) * pageSize, take: pageSize }
    );
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Pagos pendientes de autorización</h2>
                <span className="text-sm text-muted">{total} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Monto neto USD</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Moneda local</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Método</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Fecha reporte</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map((pago) => {
                            const cliente = clienteNombre(pago);
                            return (
                                <tr key={pago.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-body">{cliente.nombre}</div>
                                        <div className="text-xs text-muted">{cliente.tipo} · {cliente.email}</div>
                                    </td>
                                    <td className="px-4 py-3">${pago.montoNetoUSD.toFixed(2)}</td>
                                    <td className="px-4 py-3">{pago.monedaLocal} {pago.montoLocalPagado.toLocaleString("es-CO")}</td>
                                    <td className="px-4 py-3">{pago.metodoDeclarado}</td>
                                    <td className="px-4 py-3">{new Date(pago.fechaReporte).toLocaleDateString("es-CO")}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/dashboard/admin/pagos/cliente/${pago.suscripcionId}`}
                                                className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-body hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                                            >
                                                Ver cliente
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                                    No hay pagos pendientes.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted">
                    <span>Página {page} de {totalPages}</span>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Siguiente
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
