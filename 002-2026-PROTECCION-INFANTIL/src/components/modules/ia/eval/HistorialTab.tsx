"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatPct } from "./format";
import type { Experimento } from "./types";

export function HistorialTab() {
    const [runs, setRuns] = useState<Experimento[]>([]);
    const [loading, setLoading] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ia/experimentos", { credentials: "include", cache: "no-store" });
            const data = await res.json();
            if (res.ok) setRuns(data.items || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-body">Historial de corridas</h3>
            {loading ? (
                <p className="mt-4 text-sm text-muted">Cargando...</p>
            ) : runs.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Sin corridas.</p>
            ) : (
                <div className="mt-4 space-y-3">
                    {runs.map((run) => {
                        const metrics = (run.resultadoJson?.metrics || {}) as {
                            errorSilencioso?: number;
                            revisionManualRate?: number;
                            accuracy?: number;
                        };
                        return (
                            <div key={run.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-body">{run.nombre || `Run ${run.id.slice(0, 8)}`}</span>
                                    <Badge variant={run.estado === "COMPLETADA" ? "success" : run.estado === "FALLIDA" ? "danger" : "warning"}>
                                        {run.estado}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted">
                                    {new Date(run.iniciadoEn).toLocaleString()} · v{run.fixtureVersion}
                                </p>
                                {run.estado === "COMPLETADA" && (
                                    <div className="mt-2 flex gap-3 text-xs">
                                        <span>error silencioso: {formatPct(metrics.errorSilencioso ?? 0)}</span>
                                        <span>revisión manual: {formatPct(metrics.revisionManualRate ?? 0)}</span>
                                        <span>accuracy: {formatPct(metrics.accuracy ?? 0)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </GlassCard>
    );
}
