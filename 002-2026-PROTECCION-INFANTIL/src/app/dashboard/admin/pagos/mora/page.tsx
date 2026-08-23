import Link from "next/link";
import { EstadoSuscripcion } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; estado?: string }>;
}

function titularNombre(suscripcion: Awaited<ReturnType<PagosRepository["listarMora"]>>["items"][number]) {
    if (suscripcion.colegio) return { tipo: "COLEGIO", nombre: suscripcion.colegio.nombre };
    if (suscripcion.usuario) return { tipo: "PADRE", nombre: suscripcion.usuario.nombre };
    return { tipo: "DESCONOCIDO", nombre: "—" };
}

export default async function MoraPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    const estadoRaw = params.estado?.toUpperCase();
    const estado =
        estadoRaw === "EN_GRACIA" || estadoRaw === "SUSPENDIDA" ? (estadoRaw as EstadoSuscripcion) : undefined;

    const { items, total } = await new PagosRepository().listarMora(
        { estado },
        { skip: (page - 1) * pageSize, take: pageSize }
    );
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Suscripciones en mora</h2>
                <span className="text-sm text-muted">{total} registro(s)</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Titular</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Estado</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Plan</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Fecha fin</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map((s) => {
                            const titular = titularNombre(s);
                            return (
                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-body">{titular.nombre}</div>
                                        <div className="text-xs text-muted">{titular.tipo}</div>
                                    </td>
                                    <td className="px-4 py-3">{s.estado}</td>
                                    <td className="px-4 py-3">{s.planActual.nombre}</td>
                                    <td className="px-4 py-3">{new Date(s.fechaFin).toLocaleDateString("es-CO")}</td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/dashboard/admin/pagos/cliente/${s.id}`}
                                            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-body hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                                        >
                                            Ver cliente
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                                    No hay suscripciones en mora.
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
                                href={`/dashboard/admin/pagos/mora?page=${page - 1}${estado ? `&estado=${estado}` : ""}`}
                                className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/mora?page=${page + 1}${estado ? `&estado=${estado}` : ""}`}
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
