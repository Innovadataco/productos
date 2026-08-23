import Link from "next/link";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string }>;
}

function titularNombre(pago: Awaited<ReturnType<PagosRepository["listarPagosPendientes"]>>["items"][number]) {
    if (pago.suscripcion.colegio) return pago.suscripcion.colegio.nombre;
    if (pago.suscripcion.usuario) return pago.suscripcion.usuario.nombre;
    return "—";
}

export default async function ReembolsosPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));

    // Histórico de reembolsos ya procesados.
    const repo = new PagosRepository();
    const where = { estado: "REEMBOLSADO" as const };
    const [items, total] = await Promise.all([
        repo["db"].pago.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                suscripcion: {
                    include: {
                        colegio: { select: { id: true, nombre: true } },
                        usuario: { select: { id: true, nombre: true, email: true } },
                    },
                },
            },
        }),
        repo["db"].pago.count({ where }),
    ]);
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Reembolsos</h2>
                <span className="text-sm text-muted">{total} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Titular</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Monto reembolsado USD</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Motivo</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Referencia</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {items.map((pago) => (
                            <tr key={pago.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-body">{titularNombre(pago as never)}</div>
                                </td>
                                <td className="px-4 py-3">${(pago.montoReembolsoUSD ?? 0).toFixed(2)}</td>
                                <td className="px-4 py-3 max-w-xs truncate">{pago.motivoReembolso ?? "—"}</td>
                                <td className="px-4 py-3">{pago.referenciaReembolso ?? "—"}</td>
                                <td className="px-4 py-3">{new Date(pago.updatedAt).toLocaleDateString("es-CO")}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                                    No hay reembolsos registrados.
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
                                href={`/dashboard/admin/pagos/reembolsos?page=${page - 1}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Anterior
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/reembolsos?page=${page + 1}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
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
