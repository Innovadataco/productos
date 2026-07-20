"use client";

import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronIcon } from "./AuditFilters";
import { formatDate, formatValorNuevo } from "./types";
import type { AuditResponse } from "./types";

interface AuditTableProps {
    data: AuditResponse | null;
    loading: boolean;
    error: string;
    page: number;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    onPageChange: (page: number) => void;
}

export function AuditTable({ data, loading, error, page, expandedIds, onToggle, onPageChange }: AuditTableProps) {
    if (error) {
        return <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</div>;
    }

    return (
        <div>
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
                <EmptyState
                    title="No hay registros de auditoría"
                    description="Prueba ajustar los filtros de acción o fecha."
                />
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
                                                onClick={() => onToggle(item.id)}
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
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        disabled={page <= 1 || loading}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm text-muted">
                        Página {data.pagination.page} de {data.pagination.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => onPageChange(Math.min(data.pagination.totalPages, page + 1))}
                        disabled={page >= data.pagination.totalPages || loading}
                    >
                        Siguiente
                    </Button>
                </div>
            )}
        </div>
    );
}
