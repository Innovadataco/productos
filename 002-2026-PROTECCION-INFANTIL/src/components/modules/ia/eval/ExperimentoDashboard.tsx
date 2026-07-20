"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { BarChart } from "@/components/modules/BarChart";
import { MetricCard } from "./MetricCard";
import { formatDuration, formatMs } from "./format";
import type { ExperimentoDetalle, PerCategoryMetrics } from "./types";

interface ExperimentoDashboardProps {
    id: string;
    onBack: () => void;
    onRefresh: () => void;
}

export function ExperimentoDashboard({ id, onBack, onRefresh }: ExperimentoDashboardProps) {
    const [data, setData] = useState<ExperimentoDetalle | null>(null);
    const [resultados, setResultados] = useState<Array<Record<string, unknown>>>([]);
    const [loading, setLoading] = useState(false);
    const [filterCategoria, setFilterCategoria] = useState("");
    const [pollTick, setPollTick] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [detailRes, resultadosRes] = await Promise.all([
                fetch(`/api/admin/ia/experimentos/${id}`, { credentials: "include", cache: "no-store" }),
                fetch(`/api/admin/ia/experimentos/${id}/resultados?correcto=false`, { credentials: "include", cache: "no-store" }),
            ]);
            const detailData = await detailRes.json();
            const resultadosData = await resultadosRes.json();
            if (detailRes.ok) setData(detailData);
            if (resultadosRes.ok) setResultados(resultadosData.items || []);
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
        if (!data) return;
        if (data.experimento.estado === "PENDIENTE" || data.experimento.estado === "EN_PROGRESO") {
            const t = setInterval(() => setPollTick((x) => x + 1), 3000);
            return () => clearInterval(t);
        }
    }, [data]);

    async function usarConfiguracion() {
        try {
            const res = await fetch(`/api/admin/ia/experimentos/${id}/preparar-activacion`, {
                method: "POST",
                credentials: "include",
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error?.message || "Error");
            // Pre-cargar en localStorage para que la tab Configuración la lea.
            localStorage.setItem("experiment_pending_config", JSON.stringify(payload.parametros));
            window.location.href = "/dashboard/admin/ia?tab=configuracion";
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error");
        }
    }

    if (loading && !data) return <p className="text-sm text-muted">Cargando experimento...</p>;
    if (!data) return <ErrorState title="No se pudo cargar el experimento" description="Ocurrió un problema al cargar el detalle. Intenta de nuevo." onRetry={load} />;

    const exp = data.experimento;
    const metrics = data.metrics;
    const baseline = data.baseline;
    const perCategory = data.perCategory;
    const operational = data.operational;

    const filteredResultados = filterCategoria
        ? resultados.filter((r: Record<string, unknown>) => r.esperado === filterCategoria)
        : resultados;

    const chartData = perCategory
        ? Object.entries(perCategory).map(([cat, m]) => ({
              label: cat,
              value: Math.round((m as PerCategoryMetrics).f1 * 100),
          }))
        : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Button variant="ghost" onClick={onBack}>
                        ← Volver
                    </Button>
                    <h3 className="mt-2 text-xl font-semibold text-body">{exp.nombre || `Experimento ${exp.id.slice(0, 8)}`}</h3>
                    <p className="text-sm text-muted">
                        {exp.estado} · fixture v{exp.fixtureVersion} · {new Date(exp.iniciadoEn).toLocaleString()}
                    </p>
                </div>
                {exp.estado === "COMPLETADA" && (
                    <Button variant="secondary" onClick={usarConfiguracion}>
                        Usar esta configuración
                    </Button>
                )}
            </div>

            {(exp.estado === "PENDIENTE" || exp.estado === "EN_PROGRESO") && (
                <GlassCard className="p-4">
                    <p className="text-sm text-muted">
                        Progreso: {exp.progresoCasos}/{exp.progresoTotal} casos
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                            className="h-2 rounded-full bg-sky-500 transition-all"
                            style={{ width: `${exp.progresoTotal ? (exp.progresoCasos / exp.progresoTotal) * 100 : 0}%` }}
                        />
                    </div>
                </GlassCard>
            )}

            {exp.error && (
                <GlassCard className="border-l-4 border-l-red-500 p-4">
                    <p className="text-sm text-red-600 dark:text-red-400">{exp.error}</p>
                </GlassCard>
            )}

            {data.baselineMissing && (
                <GlassCard className="border-l-4 border-l-amber-500 p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Sin línea de base — corré un experimento con la configuración de producción actual para comparar.
                    </p>
                </GlassCard>
            )}

            {metrics && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <MetricCard
                            label="Error silencioso"
                            value={metrics.errorSilencioso}
                            baseline={baseline?.metrics.errorSilencioso}
                            invert
                        />
                        <MetricCard label="Accuracy" value={metrics.accuracy} baseline={baseline?.metrics.accuracy} />
                        <MetricCard label="Recall OTRO" value={metrics.recallOTRO} baseline={baseline?.metrics.recallOTRO} />
                        <MetricCard
                            label="Revisión manual"
                            value={metrics.revisionManualRate}
                            baseline={baseline?.metrics.revisionManualRate}
                            invert
                        />
                    </div>

                    {operational && (
                        <GlassCard className="p-5">
                            <h4 className="font-semibold text-body">Métricas operativas</h4>
                            <div className="mt-3 grid gap-4 md:grid-cols-4 text-sm">
                                <div>
                                    <p className="text-muted">Duración total</p>
                                    <p className="font-medium">{formatDuration(operational.duracionTotalMs)}</p>
                                </div>
                                <div>
                                    <p className="text-muted">Casos/minuto</p>
                                    <p className="font-medium">{operational.casosPorMinuto.toFixed(1)}</p>
                                </div>
                                <div>
                                    <p className="text-muted">Latencia p50 / p95</p>
                                    <p className="font-medium">
                                        {formatMs(metrics.latencyP50Ms)} / {formatMs(metrics.latencyP95Ms)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted">Tiempo por reporte</p>
                                    <p className="font-medium">~{formatMs(metrics.latencyP50Ms)}</p>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {perCategory && (
                        <GlassCard className="p-5">
                            <h4 className="font-semibold text-body">F1 por categoría</h4>
                            <div className="mt-3">
                                <BarChart data={chartData} ariaLabel="F1 por categoría" />
                            </div>
                        </GlassCard>
                    )}
                </>
            )}

            {resultados.length > 0 && (
                <GlassCard className="p-5">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-body">Casos fallados ({filteredResultados.length})</h4>
                        <Select
                            label="Filtrar categoría"
                            value={filterCategoria}
                            onChange={(e) => setFilterCategoria(e.target.value)}
                            options={[{ value: "", label: "Todas" }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                        />
                    </div>
                    <div className="mt-4 space-y-3 max-h-96 overflow-auto">
                        {filteredResultados.slice(0, 20).map((r: Record<string, unknown>) => (
                            <div key={String(r.id)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                <div className="flex gap-2">
                                    <Badge variant="danger">Esperado: {String(r.esperado)}</Badge>
                                    <Badge variant="warning">Predicho: {String(r.predicho)}</Badge>
                                    <span className="text-muted">confianza: {Number(r.confianza).toFixed(2)}</span>
                                </div>
                                <p className="mt-2 text-muted line-clamp-2">{String((r.casoEval as Record<string, unknown>)?.texto || "")}</p>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}
        </div>
    );
}

const CATEGORIAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
];
