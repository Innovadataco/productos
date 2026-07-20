"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { AUDIT_ACTION_GROUPS, labelAccionAudit } from "@/lib/audit-actions";
import type { AccionAudit } from "@prisma/client";

type UsuarioResumen = {
    nombre: string | null;
    email: string;
};

type AuditLogItem = {
    id: string;
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId: string | null;
    usuario: UsuarioResumen | null;
    creadoEn: string;
    valorNuevo: string | null;
};

type Pagination = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

type AuditResponse = {
    items: AuditLogItem[];
    pagination: Pagination;
};

type Filters = {
    selectedActions: AccionAudit[];
    fechaDesde: string;
    fechaHasta: string;
    q: string;
    recursoId: string;
};

const DEFAULT_PAGE_SIZE = 25;

function buildQueryParams(filters: Filters, page: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(DEFAULT_PAGE_SIZE));
    if (filters.selectedActions.length > 0) {
        params.set("acciones", filters.selectedActions.join(","));
    }
    if (filters.fechaDesde) params.set("fechaDesde", filters.fechaDesde);
    if (filters.fechaHasta) params.set("fechaHasta", filters.fechaHasta);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.recursoId.trim()) params.set("recursoId", filters.recursoId.trim());
    return params;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatValorNuevo(valor: string | null): string {
    if (!valor) return "—";
    try {
        const parsed = JSON.parse(valor);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return valor;
    }
}

export function AuditLogViewer({
    defaultActions,
    title,
    subtitle,
}: {
    defaultActions?: AccionAudit[];
    title: string;
    subtitle: string;
}) {
    const [filters, setFilters] = useState<Filters>({
        selectedActions: defaultActions ?? [],
        fechaDesde: "",
        fechaHasta: "",
        q: "",
        recursoId: "",
    });
    const [page, setPage] = useState(1);
    const [data, setData] = useState<AuditResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const allActionValues = useMemo(
        () => AUDIT_ACTION_GROUPS.flatMap((group) => group.actions),
        []
    );

    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            setLoading(true);
            setError("");
            try {
                const params = buildQueryParams(filters, page);
                const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
                    credentials: "include",
                });
                const json = await res.json().catch(() => ({}));
                if (!cancelled) {
                    if (res.ok) {
                        setData(json as AuditResponse);
                    } else {
                        setError(json?.error?.message || "Error cargando auditoría");
                    }
                }
            } catch {
                if (!cancelled) setError("Error de red cargando auditoría");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchData();
        return () => {
            cancelled = true;
        };
    }, [filters, page]);

    function applyFilters(next: Partial<Filters>) {
        setFilters((prev) => ({ ...prev, ...next }));
        setPage(1);
    }

    function toggleAction(action: AccionAudit) {
        setFilters((prev) => {
            const exists = prev.selectedActions.includes(action);
            const selected = exists
                ? prev.selectedActions.filter((a) => a !== action)
                : [...prev.selectedActions, action];
            return { ...prev, selectedActions: selected };
        });
        setPage(1);
    }

    function toggleGroup(groupActions: AccionAudit[]) {
        setFilters((prev) => {
            const allSelected = groupActions.every((a) => prev.selectedActions.includes(a));
            const rest = prev.selectedActions.filter((a) => !groupActions.includes(a));
            return {
                ...prev,
                selectedActions: allSelected ? rest : [...rest, ...groupActions],
            };
        });
        setPage(1);
    }

    function toggleExpand(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const hasActiveFilters =
        filters.selectedActions.length > 0 ||
        filters.fechaDesde ||
        filters.fechaHasta ||
        filters.q.trim() ||
        filters.recursoId.trim();

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">{title}</h1>
                <p className="text-sm text-muted">{subtitle}</p>
            </div>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Filtros</h2>
                <div className="mt-4 grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div>
                            <p className="mb-2 text-sm font-medium text-body">Tipo de acción</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {AUDIT_ACTION_GROUPS.map((group) => {
                                    const groupSelected = group.actions.every((a) =>
                                        filters.selectedActions.includes(a)
                                    );
                                    const groupPartial =
                                        group.actions.some((a) => filters.selectedActions.includes(a)) &&
                                        !groupSelected;
                                    return (
                                        <div
                                            key={group.key}
                                            className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                        >
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={groupSelected}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = groupPartial;
                                                    }}
                                                    onChange={() => toggleGroup(group.actions)}
                                                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                                                />
                                                <span className="text-sm font-semibold text-body">{group.label}</span>
                                            </label>
                                            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                                                {group.actions.map((action) => (
                                                    <label
                                                        key={action}
                                                        className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-body"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.selectedActions.includes(action)}
                                                            onChange={() => toggleAction(action)}
                                                            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                                                        />
                                                        {labelAccionAudit(action)}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ selectedActions: allActionValues })}
                                    className="cursor-pointer text-xs text-accent hover:underline"
                                >
                                    Seleccionar todas
                                </button>
                                <span className="text-xs text-muted">·</span>
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ selectedActions: [] })}
                                    className="cursor-pointer text-xs text-accent hover:underline"
                                >
                                    Limpiar selección
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                            <Input
                                label="Fecha desde"
                                type="date"
                                value={filters.fechaDesde}
                                onChange={(e) => applyFilters({ fechaDesde: e.target.value })}
                            />
                            <Input
                                label="Fecha hasta"
                                type="date"
                                value={filters.fechaHasta}
                                onChange={(e) => applyFilters({ fechaHasta: e.target.value })}
                            />
                        </div>
                        <Input
                            label="Usuario (nombre o email)"
                            type="text"
                            placeholder="Buscar..."
                            value={filters.q}
                            onChange={(e) => applyFilters({ q: e.target.value })}
                        />
                        <Input
                            label="Recurso ID"
                            type="text"
                            placeholder="ID del recurso"
                            value={filters.recursoId}
                            onChange={(e) => applyFilters({ recursoId: e.target.value })}
                        />
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setFilters({
                                    selectedActions: defaultActions ?? [],
                                    fechaDesde: "",
                                    fechaHasta: "",
                                    q: "",
                                    recursoId: "",
                                });
                                setPage(1);
                            }}
                            disabled={!hasActiveFilters}
                        >
                            Limpiar filtros
                        </Button>
                    </div>
                </div>
            </GlassCard>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <GlassCard>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-body">Registros</h2>
                    {data && (
                        <p className="text-sm text-muted">
                            {data.pagination.total} resultado{data.pagination.total !== 1 ? "s" : ""}
                            {data.pagination.totalPages > 1 &&
                                ` · Página ${data.pagination.page} de ${data.pagination.totalPages}`}
                        </p>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando auditoría...
                    </div>
                ) : !data || data.items.length === 0 ? (
                    <p className="py-6 text-sm text-muted">No hay registros de auditoría para los filtros aplicados.</p>
                ) : (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Acción</th>
                                    <th className="pb-3 font-medium">Recurso</th>
                                    <th className="pb-3 font-medium">Usuario</th>
                                    <th className="pb-3 font-medium">Fecha</th>
                                    <th className="pb-3 font-medium text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.items.map((item) => (
                                    <Fragment key={item.id}>
                                        <tr className="align-top transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="py-3 pr-3">
                                                <Badge variant="info" className="text-[10px]">
                                                    {item.accion}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-3 text-muted">
                                                <div className="text-body">{item.tipoRecurso}</div>
                                                {item.recursoId && (
                                                    <div className="mt-0.5 text-xs text-subtle font-mono truncate max-w-[180px]">
                                                        {item.recursoId}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 text-muted">
                                                {item.usuario ? (
                                                    <div>
                                                        <div className="text-body">{item.usuario.nombre || item.usuario.email}</div>
                                                        {item.usuario.nombre && (
                                                            <div className="text-xs text-subtle">{item.usuario.email}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 text-muted whitespace-nowrap">
                                                {formatDate(item.creadoEn)}
                                            </td>
                                            <td className="py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(item.id)}
                                                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-accent hover:underline"
                                                    aria-expanded={expandedIds.has(item.id)}
                                                >
                                                    {expandedIds.has(item.id) ? "Ocultar" : "Ver"}
                                                    <ChevronIcon expanded={expandedIds.has(item.id)} />
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedIds.has(item.id) && (
                                            <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                                                <td colSpan={5} className="py-3 px-3">
                                                    <p className="mb-1 text-xs font-medium text-subtle">Valor nuevo</p>
                                                    <pre className="max-h-48 overflow-auto rounded-xl bg-white p-3 text-xs text-body dark:bg-slate-900">
                                                        {formatValorNuevo(item.valorNuevo)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && data.pagination.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                        <Button
                            variant="outline"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                        >
                            Anterior
                        </Button>
                        <span className="text-sm text-muted">
                            Página {data.pagination.page} de {data.pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                            disabled={page >= data.pagination.totalPages || loading}
                        >
                            Siguiente
                        </Button>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}
