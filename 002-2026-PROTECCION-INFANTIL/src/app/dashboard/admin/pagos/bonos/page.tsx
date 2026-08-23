import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; activo?: string }>;
}

export default async function BonosPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    const activo = params.activo === "true" ? true : params.activo === "false" ? false : undefined;

    const { items, total } = await new PagosRepository().listarBonos(
        { activo },
        { skip: (page - 1) * pageSize, take: pageSize }
    );
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Bonos promocionales</h2>
                <span className="text-sm text-muted">{total} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Valor</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Vigencia</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Activo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map((b) => (
                            <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-medium text-body">{b.nombre}</td>
                                <td className="px-4 py-3">{b.tipo}</td>
                                <td className="px-4 py-3">{b.valor}</td>
                                <td className="px-4 py-3">
                                    {new Date(b.vigenciaInicio).toLocaleDateString("es-CO")} —{" "}
                                    {new Date(b.vigenciaFin).toLocaleDateString("es-CO")}
                                </td>
                                <td className="px-4 py-3">{b.activo ? "Sí" : "No"}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                                    No hay bonos.
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
                                href={`/dashboard/admin/pagos/bonos?page=${page - 1}${activo !== undefined ? `&activo=${activo}` : ""}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </a>
                        )}
                        {page < totalPages && (
                            <a
                                href={`/dashboard/admin/pagos/bonos?page=${page + 1}${activo !== undefined ? `&activo=${activo}` : ""}`}
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
