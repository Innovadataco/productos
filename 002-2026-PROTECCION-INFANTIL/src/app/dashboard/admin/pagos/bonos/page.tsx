import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { OrigenBono } from "@prisma/client";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; activo?: string; origen?: string }>;
}

export default async function BonosPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    const activo = params.activo === "true" ? true : params.activo === "false" ? false : undefined;
    const origen = params.origen === OrigenBono.RECOMPENSA_PAGO ? OrigenBono.RECOMPENSA_PAGO : undefined;

    const { items, total } = await new PagosRepository().listarBonos(
        { activo, origen },
        { skip: (page - 1) * pageSize, take: pageSize }
    );
    const totalPages = Math.ceil(total / pageSize);

    function queryExtra(siguientePage?: number): string {
        const partes: string[] = [];
        if (siguientePage !== undefined) partes.push(`page=${siguientePage}`);
        if (activo !== undefined) partes.push(`activo=${activo}`);
        if (origen !== undefined) partes.push(`origen=${origen}`);
        return partes.length > 0 ? `?${partes.join("&")}` : "";
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-body">Bonos promocionales</h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted">{total} registro(s)</span>
                    <form method="get" className="flex items-center gap-2">
                        <input type="hidden" name="activo" value={activo?.toString() ?? ""} />
                        <select
                            name="origen"
                            defaultValue={origen ?? ""}
                            aria-label="Filtrar por origen"
                            className="rounded-xl border border-tinta/10 bg-papel px-3 py-1.5 text-sm text-body dark:border-tinta/20"
                            onChange={(e) => e.currentTarget.form?.submit()}
                        >
                            <option value="">Todos los orígenes</option>
                            <option value={OrigenBono.RECOMPENSA_PAGO}>Recompensa por pago</option>
                        </select>
                    </form>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Nombre</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Origen</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Valor</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Vigencia</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Activo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {items.map((b) => (
                            <tr key={b.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                <td className="px-4 py-3 font-medium text-body">{b.nombre}</td>
                                <td className="px-4 py-3">
                                    {b.origen === OrigenBono.RECOMPENSA_PAGO ? "Recompensa" : "Promoción admin"}
                                </td>
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
                                <td colSpan={6} className="px-4 py-8 text-center text-muted">
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
                                href={`/dashboard/admin/pagos/bonos${queryExtra(page - 1)}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Anterior
                            </a>
                        )}
                        {page < totalPages && (
                            <a
                                href={`/dashboard/admin/pagos/bonos${queryExtra(page + 1)}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
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
