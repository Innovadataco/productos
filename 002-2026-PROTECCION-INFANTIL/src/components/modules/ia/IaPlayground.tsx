"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Slider } from "@/components/ui/Slider";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/modules/BarChart";
import { IaTraceTimeline } from "./IaTraceTimeline";
import type { SandboxOverrides, SandboxTrace } from "@/lib/ai/sandbox";
import type { SandboxComparisonResponse } from "@/app/api/admin/ia/sandbox/route";

interface IaPlaygroundProps {
    initialOverrides?: SandboxOverrides;
}

type NumericOverrideKey = keyof Omit<SandboxOverrides, "modelo_clasificacion">;

const DEFAULT_OVERRIDES: Required<Record<NumericOverrideKey, number>> = {
    umbral_revision: 1.0,
    n_votos: 5,
    temperatura_votos: 0.7,
    min_score_categoria: 0.3,
    rag_top_k: 3,
};

const PARAM_KEYS: NumericOverrideKey[] = [
    "umbral_revision",
    "n_votos",
    "temperatura_votos",
    "min_score_categoria",
    "rag_top_k",
];

const PARAM_LABELS: Record<NumericOverrideKey, string> = {
    umbral_revision: "Umbral revisión",
    n_votos: "N votos",
    temperatura_votos: "Temperatura votos",
    min_score_categoria: "Score mínimo categoría",
    rag_top_k: "RAG top-k",
};

const PARAM_CONFIG: Record<NumericOverrideKey, { min: number; max: number; step: number; format: (v: number) => string }> = {
    umbral_revision: { min: 0.5, max: 1.0, step: 0.1, format: (v) => v.toFixed(1) },
    n_votos: { min: 1, max: 7, step: 1, format: (v) => String(v) },
    temperatura_votos: { min: 0, max: 1, step: 0.1, format: (v) => v.toFixed(1) },
    min_score_categoria: { min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
    rag_top_k: { min: 0, max: 10, step: 1, format: (v) => String(v) },
};

const EXAMPLE_TEXT =
    "un man le pide fotos a mi hija de 11 en roblox y amenaza con publicarlas si no le manda más";

function formatLatency(ms: number) {
    return `${ms} ms`;
}

function voteData(trace: SandboxTrace) {
    return trace.etapas.votacion.distribucion.map((d) => ({ label: d.categoria, value: d.count }));
}

function DecisionCard({ trace, title }: { trace: SandboxTrace; title?: string }) {
    const { decision, latenciaTotalMs } = trace;
    return (
        <GlassCard className="p-4">
            {title && <h4 className="mb-2 text-sm font-semibold text-muted">{title}</h4>}
            <div className="flex flex-wrap items-center gap-3">
                <Badge variant={decision.estado === "CLASIFICADO" ? "success" : "warning"}>
                    {decision.estado}
                </Badge>
                <Badge variant="info">{decision.categoria}</Badge>
                <span className="text-sm text-muted">confianza {(decision.confianza * 100).toFixed(0)}%</span>
                <span className="text-sm text-muted">umbral {trace.parametrosEfectivos.umbralRevision}</span>
                <span className="text-sm text-muted">{formatLatency(latenciaTotalMs)}</span>
            </div>
        </GlassCard>
    );
}

function VoteSummary({ trace }: { trace: SandboxTrace }) {
    const data = voteData(trace);
    return (
        <GlassCard className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-body">Distribución de votos</h4>
            <BarChart ariaLabel="Distribución de votos" data={data} />
            <p className="mt-2 text-xs text-muted">
                {trace.parametrosEfectivos.modeloClasificacion} · {trace.parametrosEfectivos.nVotos} votos
            </p>
        </GlassCard>
    );
}

async function fetchConfig(): Promise<SandboxOverrides> {
    try {
        const res = await fetch("/api/config/parametros", { credentials: "include" });
        if (!res.ok) return {};
        const data = await res.json();
        const params = data?.parametros || [];
        const find = (clave: string) => {
            const p = params.find((x: { clave: string; valor: string }) => x.clave === clave);
            return p ? parseFloat(p.valor) : undefined;
        };
        return {
            umbral_revision: find("reportes.classification.umbral_revision"),
            n_votos: find("reportes.classification.n_votos"),
            temperatura_votos: find("reportes.classification.temperatura_votos"),
            min_score_categoria: find("reportes.classification.min_score_categoria"),
            rag_top_k: find("reportes.classification.rag_top_k"),
        };
    } catch {
        return {};
    }
}

export function IaPlayground({ initialOverrides }: IaPlaygroundProps) {
    const [texto, setTexto] = useState("");
    const [overrides, setOverrides] = useState<SandboxOverrides>(() => initialOverrides || {});
    const [baseConfig, setBaseConfig] = useState<SandboxOverrides>({});
    const [loading, setLoading] = useState(false);
    const [comparando, setComparando] = useState(false);
    const [single, setSingle] = useState<SandboxTrace | null>(null);
    const [comparison, setComparison] = useState<SandboxComparisonResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchConfig().then((cfg) => {
            setBaseConfig(cfg);
            if (!initialOverrides) {
                setOverrides({ ...cfg });
            }
        });
    }, [initialOverrides]);

    const updateOverride = useCallback((key: NumericOverrideKey, value: number) => {
        setOverrides((prev) => ({ ...prev, [key]: value }));
    }, []);

    const sanitize = (o: SandboxOverrides): SandboxOverrides => {
        const out: SandboxOverrides = {};
        if (o.modelo_clasificacion) {
            out.modelo_clasificacion = o.modelo_clasificacion;
        }
        for (const key of PARAM_KEYS) {
            const v = o[key];
            if (v !== undefined && Number.isFinite(v)) {
                out[key] = v;
            }
        }
        return out;
    };

    const run = async (comparar: boolean) => {
        if (!texto.trim()) return;
        setError(null);
        if (comparar) {
            setComparando(true);
            setSingle(null);
        } else {
            setLoading(true);
            setComparison(null);
        }
        try {
            const res = await fetch("/api/admin/ia/sandbox", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: texto.trim(), parametrosOverride: sanitize(overrides), comparar }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error?.message || `Error ${res.status}`);
            }
            if (comparar) {
                setComparison(json as SandboxComparisonResponse);
            } else {
                setSingle((json as { trace: SandboxTrace }).trace);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
            setComparando(false);
        }
    };

    const resetToBase = useCallback(() => {
        setOverrides({ ...baseConfig });
    }, [baseConfig]);

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
                <GlassCard className="p-4 lg:col-span-2">
                    <label htmlFor="sandbox-texto" className="mb-2 block text-sm font-medium text-body">
                        Texto de prueba
                    </label>
                    <textarea
                        id="sandbox-texto"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Escriba aquí el texto a analizar..."
                        rows={6}
                        maxLength={4000}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => setTexto(EXAMPLE_TEXT)}
                            className="text-xs text-sky-600 hover:underline dark:text-cyan-400"
                        >
                            Cargar ejemplo
                        </button>
                        <span className="text-xs text-subtle">{texto.length}/4000</span>
                    </div>
                </GlassCard>

                <GlassCard className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-body">Parámetros override</h3>
                        <button
                            type="button"
                            onClick={resetToBase}
                            className="text-xs text-sky-600 hover:underline dark:text-cyan-400"
                        >
                            Restaurar configuración actual
                        </button>
                    </div>
                    <div className="space-y-4">
                        {PARAM_KEYS.map((key) => {
                            const cfg = PARAM_CONFIG[key];
                            const val = overrides[key] ?? baseConfig[key] ?? DEFAULT_OVERRIDES[key];
                            return (
                                <Slider
                                    key={key}
                                    label={`${PARAM_LABELS[key]} (${cfg.format(val)})`}
                                    min={cfg.min}
                                    max={cfg.max}
                                    step={cfg.step}
                                    value={val}
                                    onChange={(v) => updateOverride(key, v)}
                                />
                            );
                        })}
                    </div>
                    <p className="mt-4 text-xs text-muted">
                        Estos valores se usan solo en el sandbox. No afectan la configuración del sistema.
                    </p>
                </GlassCard>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => run(false)} disabled={loading || comparando || !texto.trim()}>
                    {loading ? "Analizando..." : "Analizar"}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => run(true)}
                    disabled={loading || comparando || !texto.trim()}
                >
                    {comparando ? "Comparando..." : "Comparar con configuración actual"}
                </Button>
                {comparando && (
                    <span className="text-xs text-muted">Modo comparación consume 2 ejecuciones del rate limit.</span>
                )}
            </div>

            {error && (
                <GlassCard className="border-l-4 border-l-red-500 p-4">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </GlassCard>
            )}

            {single && !comparison && (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <DecisionCard trace={single} />
                        <VoteSummary trace={single} />
                    </div>
                    <IaTraceTimeline trace={single} />
                </div>
            )}

            {comparison && (
                <div className="space-y-4">
                    <GlassCard className="p-4">
                        <h4 className="mb-2 text-sm font-semibold text-body">Resumen de comparación</h4>
                        <div className="flex flex-wrap gap-2">
                            {comparison.diferencias.estadoCambio ? (
                                <Badge variant="warning">Cambio de estado</Badge>
                            ) : (
                                <Badge variant="success">Mismo estado</Badge>
                            )}
                            {comparison.diferencias.categoriaCambio && <Badge variant="warning">Cambio de categoría</Badge>}
                            {comparison.diferencias.confianzaCambio && (
                                <Badge variant="info">
                                    Confianza {comparison.diferencias.confianzaDelta >= 0 ? "+" : ""}
                                    {(comparison.diferencias.confianzaDelta * 100).toFixed(0)}%
                                </Badge>
                            )}
                        </div>
                    </GlassCard>
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-muted">Configuración actual</h4>
                            <DecisionCard trace={comparison.baseline} title="Baseline" />
                            <VoteSummary trace={comparison.baseline} />
                            <IaTraceTimeline trace={comparison.baseline} />
                        </div>
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-body">Con override</h4>
                            <DecisionCard trace={comparison.override} title="Override" />
                            <VoteSummary trace={comparison.override} />
                            <IaTraceTimeline trace={comparison.override} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
