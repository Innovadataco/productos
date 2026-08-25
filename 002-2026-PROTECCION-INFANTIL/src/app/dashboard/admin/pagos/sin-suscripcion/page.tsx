import Link from "next/link";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { ActivarSuscripcionManual } from "@/components/modules/pagos/ActivarSuscripcionManual";
import { Alerta } from "@/components/ui/Alerta";
import type {
    TargetSinSuscripcion,
    PlanManualDTO,
    PaginacionDTO,
} from "@/lib/pagos/admin-activacion-manual.types";

const API_BASE = "/api/admin/pagos";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; q?: string; tipo?: string }>;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") sp.set(key, String(value));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

function parsePagination(params: Awaited<PageProps["searchParams"]>) {
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    return { page, pageSize };
}

async function fetchJson<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

export default async function SinSuscripcionPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const { page, pageSize } = parsePagination(params);
    const q = params.q?.trim() ?? "";
    const tipo = params.tipo === "PADRE" || params.tipo === "COLEGIO" ? params.tipo : undefined;
    const anioActual = new Date().getFullYear();

    const [listado, catalogo] = await Promise.all([
        fetchJson<{ items: TargetSinSuscripcion[]; pagination: PaginacionDTO }>(
            `${API_BASE}/sin-suscripcion${toQueryString({ page, pageSize, q, tipo })}`
        ),
        fetchJson<{ items: PlanManualDTO[]; pagination: PaginacionDTO }>(
            `${API_BASE}/planes${toQueryString({ anio: anioActual, pageSize: 100 })}`
        ),
    ]);

    const items = listado?.items ?? [];
    const pagination = listado?.pagination ?? { page, pageSize, total: 0, totalPages: 1 };
    const planes = catalogo?.items ?? [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Sin suscripción</h2>
                <span className="text-sm text-muted">{pagination.total} registro(s)</span>
            </div>

            <div className="rounded-2xl glass p-4">
                <form className="flex flex-col gap-4 md:flex-row md:items-end" method="get">
                    <div className="md:w-48">
                        <label htmlFor="tipo" className="block text-sm font-medium text-body mb-1.5">
                            Tipo
                        </label>
                        <select
                            id="tipo"
                            name="tipo"
                            defaultValue={tipo ?? ""}
                            className="w-full rounded-xl px-4 py-3 text-sm text-body outline-none transition glass-input appearance-none"
                        >
                            <option value="">Todos</option>
                            <option value="PADRE">Padre</option>
                            <option value="COLEGIO">Colegio</option>
                        </select>
                    </div>
                    <div className="md:w-80">
                        <label htmlFor="q" className="block text-sm font-medium text-body mb-1.5">
                            Buscar
                        </label>
                        <input
                            id="q"
                            name="q"
                            type="text"
                            defaultValue={q}
                            placeholder="Nombre, email o identificación"
                            maxLength={120}
                            className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl bg-ambar px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ambar/25 transition hover:brightness-110"
                        >
                            Filtrar
                        </button>
                        <Link
                            href="/dashboard/admin/pagos/sin-suscripcion"
                            className="inline-flex items-center justify-center rounded-xl border border-tinta/10 px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                        >
                            Limpiar
                        </Link>
                    </div>
                </form>
            </div>

            {!listado && (
                <Alerta tono="error" role="alert">
                    No se pudo cargar el listado. Intenta de nuevo.
                </Alerta>
            )}

            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Titular</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Identificación / Email</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {items.map((target) => (
                            <tr key={`${target.tipo}-${target.id}`} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-body">{target.nombre}</div>
                                </td>
                                <td className="px-4 py-3 text-muted">{target.tipo}</td>
                                <td className="px-4 py-3 text-muted">
                                    {target.identificacion ? (
                                        <span className="block">{target.identificacion}</span>
                                    ) : null}
                                    {target.email ? <span className="block">{target.email}</span> : null}
                                    {!target.identificacion && !target.email ? "—" : null}
                                </td>
                                <td className="px-4 py-3">
                                    <ActivarSuscripcionManual modo="activar" target={target} planes={planes} />
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                                    No hay targets sin suscripción vigente.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted">
                    <span>
                        Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                        {pagination.page > 1 && (
                            <Link
                                href={`/dashboard/admin/pagos/sin-suscripcion${toQueryString({
                                    page: pagination.page - 1,
                                    pageSize,
                                    q,
                                    tipo,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Anterior
                            </Link>
                        )}
                        {pagination.page < pagination.totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/sin-suscripcion${toQueryString({
                                    page: pagination.page + 1,
                                    pageSize,
                                    q,
                                    tipo,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
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
