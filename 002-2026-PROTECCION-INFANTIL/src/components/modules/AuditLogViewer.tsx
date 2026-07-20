"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AuditFilters } from "./audit-log/AuditFilters";
import { AuditTable } from "./audit-log/AuditTable";
import { buildQueryParams, DEFAULT_PAGE_SIZE, type Filters, type AuditResponse } from "./audit-log/types";
import type { AccionAudit } from "@prisma/client";

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
        () => ["LOGIN", "LOGOUT", "PARAM_UPDATE", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "REPORT_CREATE", "REPORT_UPDATE", "REPORT_DELETE"] as AccionAudit[],
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

    function resetFilters() {
        setFilters({
            selectedActions: defaultActions ?? [],
            fechaDesde: "",
            fechaHasta: "",
            q: "",
            recursoId: "",
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

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">{title}</h1>
                <p className="text-sm text-muted">{subtitle}</p>
            </div>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Filtros</h2>
                <AuditFilters
                    filters={filters}
                    defaultActions={defaultActions}
                    onApply={applyFilters}
                    onReset={resetFilters}
                />
            </GlassCard>

            <GlassCard>
                <AuditTable
                    data={data}
                    loading={loading}
                    error={error}
                    page={page}
                    expandedIds={expandedIds}
                    onToggle={toggleExpand}
                    onPageChange={setPage}
                />
            </GlassCard>
        </div>
    );
}
