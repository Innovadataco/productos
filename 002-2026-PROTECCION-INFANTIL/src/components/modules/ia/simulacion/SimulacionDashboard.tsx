"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatDuration, formatMs } from "../eval/format";
import { TablaResultadosSimulacion } from "./TablaResultadosSimulacion";
import { MetricasSimulacion } from "./MetricasSimulacion";
import type { SimulacionRun, ResultadoCaso, MetricasSimulacionUI } from "./types";

interface SimulacionDashboardProps {
    id: string;
    onBack: () => void;
    onRefresh: () => void;
}

export function SimulacionDashboard({ id, onBack, onRefresh }: SimulacionDashboardProps) {
    const [run, setRun] = useState<SimulacionRun | null>(null);
    const [resultados, setResultados] = useState<ResultadoCaso[]>([]);
    const [metricas, setMetricas] = useState<MetricasSimulacionUI | null>(null);
    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [activeTab, setActiveTab] = useState<"progreso" | "resultados" | "analisis">("progreso");
    const [now, setNow] = useState(Date.now);
    const [pollTick, setPollTick] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [runRes, resultadosRes, metricasRes] = await Promise.all([
                fetch(`/api/admin/ia/simulaciones/${id}`, { credentials: "include", cache: "no-store" }),
                fetch(`/api/admin/ia/simulaciones/${id}/resultados?pageSize=100`, { credentials: "include", cache: "no-store" }),
                fetch(`/api/admin/ia/simulaciones/${id}/analisis`, { credentials: "include", cache: "no-store" }),
            ]);
            const runData = await runRes.json();
            const resultadosData = await resultadosRes.json();
            const metricasData = await metricasRes.json();
            if (runRes.ok) setRun(runData);
            if (resultadosRes.ok) setResultados(resultadosData.items || []);
            if (metricasRes.ok) setMetricas(metricasData.metricas || null);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load, pollTick]);

    useEffect(() => {
        if (!run) return;
        if (run.estado === "PENDIENTE" || run.estado === "EN_PROGRESO") {
            const t = setInterval(() => {
                setPollTick((x) => x + 1);
                setNow(Date.now());
            }, 3000);
            return () => clearInterval(t);
        }
    }, [run]);

    async function cancelar() {
        if (!confirm("¿Cancelar la simulación? Los jobs ya encolados seguirán su curso.")) return;
        setCancelling(true);
        try {
            const res = await fetch(`/api/admin/ia/simulaciones/${id}/cancelar`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error");
            setPollTick((x) => x + 1);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error");
        } finally {
            setCancelling(false);
        }
    }

    async function exportar(formato: "csv" | "json") {
        window.open(`/api/admin/ia/simulaciones/${id}/export?formato=${formato}`, "_blank");
    }

    if (loading && !run) return <p className="text-sm text-muted">Cargando simulación...</p>;
    if (!run) return <ErrorState title="No se pudo cargar la simulación" description="Ocurrió un problema al cargar el detalle." onRetry={load} />;

    const elapsed = run.fechaFin
        ? new Date(run.fechaFin).getTime() - new Date(run.fechaInicio).getTime()
        : now - new Date(run.fechaInicio).getTime();

    const badgeVariant =
        run.estado === "COMPLETADA"
            ? "success"
            : run.estado === "FALLIDA" || run.estado === "CANCELADA"
              ? "danger"
              : run.estado === "EN_PROGRESO"
                ? "info"
                : "warning";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Button variant="ghost" onClick={onBack}>
                        ← Volver
                    </Button>
                    <h3 className="mt-2 text-xl font-semibold text-body">Simulación {run.id.slice(0, 8)}</h3>
                    <p className="text-sm text-muted">
                        <Badge variant={badgeVariant}>{run.estado}</Badge> · {run.totalCasos} casos · Modelo {run.modelo}
                    </p>
                </div>
                <div className="flex gap-2">
                    {(run.estado === "PENDIENTE" || run.estado === "EN_PROGRESO") && (
                        <Button variant="danger" onClick={cancelar} isLoading={cancelling}>
                            Cancelar
                        </Button>
                    )}
                    {run.estado !== "PENDIENTE" && run.estado !== "EN_PROGRESO" && (
                        <>
                            <Button variant="outline" onClick={() => exportar("csv")}>
                                Exportar CSV
                            </Button>
                            <Button variant="outline" onClick={() => exportar("json")}>
                                Exportar JSON
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {(run.estado === "PENDIENTE" || run.estado === "EN_PROGRESO") && (
                <GlassCard className="p-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">
                            Progreso: {run.progreso}/{run.totalCasos}
                        </span>
                        <span className="text-muted">Transcurrido: {formatDuration(elapsed)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                            className="h-2 rounded-full bg-sky-500 transition-all"
                            style={{ width: `${run.totalCasos ? (run.progreso / run.totalCasos) * 100 : 0}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                        Inicio: {new Date(run.fechaInicio).toLocaleString()}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Los jobs ya encolados seguirán su curso si cancela.
                    </p>
                </GlassCard>
            )}

            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-4" aria-label="Simulación tabs">
                    {[
                        { key: "progreso", label: "Progreso" },
                        { key: "resultados", label: "Resultados por caso" },
                        { key: "analisis", label: "Análisis agregado" },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as typeof activeTab)}
                            className={`inline-flex items-center border-b-2 px-1 py-2 text-sm font-medium transition ${
                                activeTab === t.key
                                    ? "border-sky-500 text-sky-600 dark:border-cyan-400 dark:text-cyan-400"
                                    : "border-transparent text-muted hover:border-slate-300 hover:text-body dark:hover:border-slate-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === "progreso" && (
                <GlassCard className="p-5">
                    <div className="grid gap-4 md:grid-cols-3 text-sm">
                        <div>
                            <p className="text-muted">Estado</p>
                            <p className="font-medium">{run.estado}</p>
                        </div>
                        <div>
                            <p className="text-muted">Casos</p>
                            <p className="font-medium">
                                {run.progreso}/{run.totalCasos}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted">Modelo</p>
                            <p className="font-medium">{run.modelo}</p>
                        </div>
                        <div>
                            <p className="text-muted">Inicio</p>
                            <p className="font-medium">{new Date(run.fechaInicio).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-muted">Transcurrido</p>
                            <p className="font-medium">{formatDuration(elapsed)}</p>
                        </div>
                        <div>
                            <p className="text-muted">Fin</p>
                            <p className="font-medium">{run.fechaFin ? new Date(run.fechaFin).toLocaleString() : "—"}</p>
                        </div>
                    </div>
                </GlassCard>
            )}

            {activeTab === "resultados" && (
                <TablaResultadosSimulacion resultados={resultados} />
            )}

            {activeTab === "analisis" && metricas && (
                <MetricasSimulacion metricas={metricas} />
            )}
        </div>
    );
}
