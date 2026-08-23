import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; tipoTitular?: string; anio?: string }>;
}

export default async function PlanesPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));

    const where: { tipoTitular?: "COLEGIO" | "PADRE"; anio?: number } = {};
    if (params.tipoTitular === "COLEGIO" || params.tipoTitular === "PADRE") {
        where.tipoTitular = params.tipoTitular;
    }
    if (params.anio) {
        const anioNum = parseInt(params.anio, 10);
        if (!Number.isNaN(anioNum)) where.anio = anioNum;
    }

    const { items, total } = await new PagosRepository().listarPlanesPaginados(where, {
        skip: (page - 1) * pageSize,
        take: pageSize,
    });
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Planes</h2>
                <span className="text-sm text-muted">{total} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Titular</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Duración</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Año</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Precio base USD</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Descuento anual %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-medium text-body">{p.nombre}</td>
                                <td className="px-4 py-3">{p.tipoTitular}</td>
                                <td className="px-4 py-3">{p.duracion}</td>
                                <td className="px-4 py-3">{p.anio}</td>
                                <td className="px-4 py-3">${p.precioBaseUSD.toFixed(2)}</td>
                                <td className="px-4 py-3">{p.descuentoAnualPct ?? 0}%</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                                    No hay planes.
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
                            <a
                                href={`/dashboard/admin/pagos/planes?page=${page - 1}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </a>
                        )}
                        {page < totalPages && (
                            <a
                                href={`/dashboard/admin/pagos/planes?page=${page + 1}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Siguiente
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
