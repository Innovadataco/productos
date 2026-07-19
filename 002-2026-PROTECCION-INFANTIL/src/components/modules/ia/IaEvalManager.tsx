"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/modules/BarChart";

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

const FUENTES = ["SEMILLA", "MANUAL_ADMIN", "PRODUCCION_ANONIMIZADO"];

interface Caso {
    id: string;
    texto: string;
    categoriaEsperada: string;
    secundariaEsperada: string | null;
    ruido: boolean;
    fuente: string;
    activo: boolean;
    fixtureVersion: number;
    creadoEn: string;
    creadoPor: { email: string | null; nombre: string | null } | null;
}

interface Experimento {
    id: string;
    nombre: string | null;
    notas: string | null;
    tipo: string;
    fixtureVersion: number;
    estado: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
    configSnapshot: Record<string, unknown> | null;
    progresoCasos: number;
    progresoTotal: number;
    resultadoJson: Record<string, unknown> | null;
    error: string | null;
    creadoPor: { email: string | null; nombre: string | null } | null;
}

interface ExperimentoDetalle {
    experimento: Experimento;
    metrics: RunMetrics | null;
    perCategory: Record<string, PerCategoryMetrics> | null;
    operational: OperationalMetrics | null;
    baseline: { id: string; nombre: string | null; metrics: RunMetrics } | null;
    baselineMissing: boolean;
}

interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    recallOTRO: number;
}

interface PerCategoryMetrics {
    precision: number;
    recall: number;
    f1: number;
    support: number;
}

interface OperationalMetrics {
    duracionTotalMs: number;
    casosPorMinuto: number;
    tasaFallbacks: number;
    activacionesGuardas: number;
    doxingVerdaderas: number;
    keywordsActivadas: number;
    prioridadAltaTotal: number;
}

interface OllamaModel {
    name: string;
    tag: string;
    size: number;
    esEmbedding: boolean;
}

interface CompareResult {
    comparable: boolean;
    fixtureVersion: number;
    experimentos: Array<{
        id: string;
        nombre: string | null;
        metrics: RunMetrics | null;
    }>;
    frontier: Array<unknown>;
    error?: { message: string };
}

function formatPct(n: number) {
    return `${(n * 100).toFixed(1)}%`;
}

function formatMs(n: number) {
    return `${Math.round(n)}ms`;
}

function formatDuration(ms: number) {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${min}m ${rest}s`;
}

function classForDelta(delta: number) {
    if (delta > 0.01) return "text-green-600 dark:text-green-400";
    if (delta < -0.01) return "text-red-600 dark:text-red-400";
    return "text-slate-500 dark:text-slate-400";
}

export function IaEvalManager() {
    const [activeTab, setActiveTab] = useState<"casos" | "laboratorio" | "historial">("laboratorio");

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6" aria-label="Eval tabs">
                    {[
                        { key: "laboratorio", label: "Laboratorio" },
                        { key: "casos", label: "Casos del fixture" },
                        { key: "historial", label: "Historial" },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as typeof activeTab)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
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

            {activeTab === "laboratorio" && <LaboratorioTab />}
            {activeTab === "casos" && <CasosTab />}
            {activeTab === "historial" && <HistorialTab />}
        </div>
    );
}

function LaboratorioTab() {
    const [view, setView] = useState<"list" | "new" | "detail" | "compare">("list");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [experiments, setExperiments] = useState<Experimento[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ia/experimentos?estado=COMPLETADA", { credentials: "include", cache: "no-store" });
            const data = await res.json();
            if (res.ok) setExperiments(data.items || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [refreshTick]);

    return (
        <div className="space-y-6">
            {view === "list" && (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-body">Experimentos</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setView("compare")} disabled={experiments.length < 2}>
                                Comparar
                            </Button>
                            <Button onClick={() => setView("new")}>Nuevo experimento</Button>
                        </div>
                    </div>
                    {loading ? (
                        <p className="text-sm text-muted">Cargando...</p>
                    ) : experiments.length === 0 ? (
                        <GlassCard className="p-6">
                            <p className="text-sm text-muted">No hay experimentos completados. Cree uno para empezar.</p>
                        </GlassCard>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {experiments.map((exp) => (
                                <ExperimentCard
                                    key={exp.id}
                                    exp={exp}
                                    onClick={() => {
                                        setSelectedId(exp.id);
                                        setView("detail");
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            {view === "new" && <NuevoExperimentoForm onBack={() => setView("list")} onCreated={() => { setView("list"); setRefreshTick((t) => t + 1); }} />}
            {view === "detail" && selectedId && (
                <ExperimentoDashboard
                    id={selectedId}
                    onBack={() => setView("list")}
                    onRefresh={() => setRefreshTick((t) => t + 1)}
                />
            )}
            {view === "compare" && <ComparadorExperimentos experiments={experiments} onBack={() => setView("list")} />}
        </div>
    );
}

function ExperimentCard({ exp, onClick }: { exp: Experimento; onClick: () => void }) {
    const metrics = (exp.resultadoJson?.metrics || {}) as RunMetrics;
    const config = exp.configSnapshot || {};
    return (
        <GlassCard className="p-5 cursor-pointer hover:shadow-md transition" onClick={onClick}>
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-semibold text-body">{exp.nombre || `Experimento ${exp.id.slice(0, 8)}`}</h4>
                    <p className="text-xs text-muted">
                        {new Date(exp.iniciadoEn).toLocaleString()} · fixture v{exp.fixtureVersion}
                    </p>
                </div>
                <Badge variant={exp.estado === "COMPLETADA" ? "success" : exp.estado === "FALLIDA" ? "danger" : "warning"}>
                    {exp.estado}
                </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                    <p className="text-muted text-xs">Error silencioso</p>
                    <p className="font-medium">{formatPct(metrics.errorSilencioso ?? 0)}</p>
                </div>
                <div>
                    <p className="text-muted text-xs">Revisión manual</p>
                    <p className="font-medium">{formatPct(metrics.revisionManualRate ?? 0)}</p>
                </div>
                <div>
                    <p className="text-muted text-xs">Accuracy</p>
                    <p className="font-medium">{formatPct(metrics.accuracy ?? 0)}</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-muted truncate">Modelo: {String(config.modeloClasificacion || "—")}</p>
        </GlassCard>
    );
}

function NuevoExperimentoForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [productionConfig, setProductionConfig] = useState<Record<string, string>>({});
    const [form, setForm] = useState({
        nombre: "",
        notas: "",
        modeloClasificacion: "",
        umbralRevision: "1.0",
        nVotos: "5",
        temperaturaVotos: "0.7",
        ragTopK: "3",
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function init() {
            try {
                const [modelsRes, paramsRes] = await Promise.all([
                    fetch("/api/admin/ia/modelos", { credentials: "include" }),
                    fetch("/api/config/parametros", { credentials: "include" }),
                ]);
                const modelsData = await modelsRes.json();
                const paramsData = await paramsRes.json();
                const params: Record<string, string> = {};
                for (const p of paramsData.items || []) params[p.clave] = p.valor;
                setModels((modelsData.models || []).filter((m: OllamaModel) => !m.esEmbedding));
                setProductionConfig(params);
                setForm((f) => ({
                    ...f,
                    modeloClasificacion: params["reportes.classification_model"] || "",
                    umbralRevision: params["reportes.classification.umbral_revision"] || "1.0",
                    nVotos: params["reportes.classification.n_votos"] || "5",
                    temperaturaVotos: params["reportes.classification.temperatura_votos"] || "0.7",
                    ragTopK: params["reportes.classification.rag_top_k"] || "3",
                }));
            } catch {
                setMessage({ type: "error", text: "Error cargando configuración inicial" });
            }
        }
        init();
    }, []);

    const estimacionMinutos = useMemo(() => {
        const casos = 110;
        const modelo = form.modeloClasificacion;
        const segundosPorCaso = modelo.includes("32b") || modelo.includes("70b") ? 60 : 7;
        return Math.max(1, Math.ceil((casos * segundosPorCaso) / 60));
    }, [form.modeloClasificacion]);

    async function lanzar() {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/ia/experimentos", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: form.nombre,
                    notas: form.notas,
                    config: {
                        modeloClasificacion: form.modeloClasificacion,
                        umbralRevision: Number(form.umbralRevision),
                        nVotos: Number(form.nVotos),
                        temperaturaVotos: Number(form.temperaturaVotos),
                        ragTopK: Number(form.ragTopK),
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error creando experimento");
            setStep(3);
            setMessage({
                type: "success",
                text: `Experimento encolado. Duración estimada: ${estimacionMinutos} min. ID: ${data.runId}`,
            });
            setTimeout(onCreated, 2000);
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-body">Nuevo experimento</h3>
                <Button variant="ghost" onClick={onBack}>
                    Volver
                </Button>
            </div>

            {message && (
                <div
                    className={`text-sm ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                >
                    {message.text}
                </div>
            )}

            {step === 1 && (
                <div className="space-y-4">
                    <p className="text-sm text-muted">Paso 1 de 2 — Configuración (no afecta producción)</p>
                    <Input
                        label="Nombre del experimento"
                        value={form.nombre}
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                        placeholder="ej. qwen 32b - prueba 1"
                    />
                    <Select
                        label="Modelo de clasificación"
                        value={form.modeloClasificacion}
                        onChange={(e) => setForm((f) => ({ ...f, modeloClasificacion: e.target.value }))}
                        options={[
                            { value: "", label: "Seleccionar modelo..." },
                            ...models.map((m) => ({ value: `${m.name}:${m.tag}`, label: `${m.name}:${m.tag}` })),
                        ]}
                    />
                    <div className="grid gap-4 md:grid-cols-4">
                        <Input label="Umbral revisión" value={form.umbralRevision} onChange={(e) => setForm((f) => ({ ...f, umbralRevision: e.target.value }))} />
                        <Input label="N votos" value={form.nVotos} onChange={(e) => setForm((f) => ({ ...f, nVotos: e.target.value }))} />
                        <Input label="Temperatura" value={form.temperaturaVotos} onChange={(e) => setForm((f) => ({ ...f, temperaturaVotos: e.target.value }))} />
                        <Input label="RAG topK" value={form.ragTopK} onChange={(e) => setForm((f) => ({ ...f, ragTopK: e.target.value }))} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-body">Notas</p>
                        <textarea
                            value={form.notas}
                            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                            rows={3}
                            className="w-full resize-y rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                        />
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-800/50">
                        Estimación: ~{estimacionMinutos} minutos con {form.modeloClasificacion || "el modelo seleccionado"}.
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setStep(2)}>Continuar</Button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <p className="text-sm text-muted">Paso 2 de 2 — Confirmar y lanzar</p>
                    <div className="space-y-2 text-sm">
                        <p>
                            <span className="text-muted">Modelo:</span> {form.modeloClasificacion}
                        </p>
                        <p>
                            <span className="text-muted">Umbral:</span> {form.umbralRevision} · N votos: {form.nVotos} · Temp: {form.temperaturaVotos} · RAG topK: {form.ragTopK}
                        </p>
                        <p>
                            <span className="text-muted">Duración estimada:</span> ~{estimacionMinutos} min
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setStep(1)}>
                            Atrás
                        </Button>
                        <Button onClick={lanzar} isLoading={loading}>
                            Lanzar experimento
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-4">
                    <p className="text-green-600 dark:text-green-400 text-sm">Experimento lanzado. Volviendo al laboratorio...</p>
                </div>
            )}
        </GlassCard>
    );
}

function ExperimentoDashboard({ id, onBack, onRefresh }: { id: string; onBack: () => void; onRefresh: () => void }) {
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
    if (!data) return <p className="text-sm text-muted">No se pudo cargar el experimento.</p>;

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

    function delta(current: number, base: number) {
        return current - base;
    }

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

function MetricCard({
    label,
    value,
    baseline,
    invert,
}: {
    label: string;
    value: number;
    baseline?: number;
    invert?: boolean;
}) {
    const d = baseline !== undefined ? value - baseline : 0;
    const sign = d > 0 ? "+" : "";
    const good = invert ? d < 0 : d > 0;
    const bad = invert ? d > 0 : d < 0;
    return (
        <GlassCard className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-semibold text-body">{formatPct(value)}</p>
            {baseline !== undefined && (
                <p className={`text-xs ${good ? "text-green-600 dark:text-green-400" : bad ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                    {sign}{formatPct(d)} vs base
                </p>
            )}
        </GlassCard>
    );
}

function ComparadorExperimentos({ experiments, onBack }: { experiments: Experimento[]; onBack: () => void }) {
    const [selected, setSelected] = useState<string[]>([]);
    const [result, setResult] = useState<CompareResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function comparar() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/ia/experimentos/comparar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selected }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data?.error?.message || "Error comparando");
                return;
            }
            setResult(data);
        } catch {
            setError("Error de red");
        } finally {
            setLoading(false);
        }
    }

    function toggle(id: string) {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev));
    }

    const metricRows = [
        { key: "errorSilencioso", label: "Error silencioso", invert: true },
        { key: "accuracy", label: "Accuracy", invert: false },
        { key: "recallOTRO", label: "Recall OTRO", invert: false },
        { key: "revisionManualRate", label: "Revisión manual", invert: true },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-body">Comparador de experimentos</h3>
                <Button variant="ghost" onClick={onBack}>
                    Volver
                </Button>
            </div>

            <GlassCard className="p-5">
                <p className="text-sm text-muted mb-3">Seleccione 2 a 5 experimentos completados de la misma fixtureVersion.</p>
                <div className="space-y-2">
                    {experiments.map((exp) => (
                        <label key={exp.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(exp.id)}
                                onChange={() => toggle(exp.id)}
                                className="h-4 w-4"
                            />
                            <span className="text-sm text-body">{exp.nombre || exp.id.slice(0, 8)}</span>
                            <span className="text-xs text-muted">v{exp.fixtureVersion}</span>
                        </label>
                    ))}
                </div>
                <div className="mt-4 flex gap-2">
                    <Button onClick={comparar} isLoading={loading} disabled={selected.length < 2}>
                        Comparar
                    </Button>
                </div>
                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </GlassCard>

            {result && result.comparable && (
                <GlassCard className="p-5 overflow-auto">
                    <h4 className="font-semibold text-body mb-3">Resultado de la comparación</h4>
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="py-2 text-left text-muted">Métrica</th>
                                {(result.experimentos as Array<{ id: string; nombre: string | null }>).map((e) => (
                                    <th key={e.id} className="py-2 px-3 text-left text-body">
                                        {e.nombre || e.id.slice(0, 8)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {metricRows.map((row) => {
                                const values = (result.experimentos as Array<{ metrics: RunMetrics | null }>).map(
                                    (e) => (e.metrics?.[row.key as keyof RunMetrics] as number) ?? 0
                                );
                                const best = row.invert ? Math.min(...values) : Math.max(...values);
                                return (
                                    <tr key={row.key} className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="py-2 text-muted">{row.label}</td>
                                        {values.map((v, i) => (
                                            <td
                                                key={i}
                                                className={`py-2 px-3 font-medium ${
                                                    Math.abs(v - best) < 0.001
                                                        ? "text-green-600 dark:text-green-400"
                                                        : "text-body"
                                                }`}
                                            >
                                                {formatPct(v)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="mt-3 text-xs text-muted">
                        Casos en la frontera (acierta uno y falla otro): {(result.frontier as Array<unknown>).length}
                    </p>
                </GlassCard>
            )}
        </div>
    );
}

function CasosTab() {
    const [casos, setCasos] = useState<Caso[]>([]);
    const [conteos, setConteos] = useState<Record<string, number>>({});
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ categoria: "", ruido: "", fuente: "", activo: "" });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [form, setForm] = useState({ texto: "", categoriaEsperada: "", secundariaEsperada: "", ruido: false });

    async function loadCasos() {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.ruido) params.set("ruido", filters.ruido);
        if (filters.fuente) params.set("fuente", filters.fuente);
        if (filters.activo) params.set("activo", filters.activo);
        try {
            const res = await fetch(`/api/admin/ia/evals/casos?${params.toString()}`, { credentials: "include" });
            const data = await res.json();
            if (res.ok) {
                setCasos(data.items || []);
                setConteos(data.conteosPorCategoria || {});
                setTotalPages(data.pagination.totalPages || 1);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando casos" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCasos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters]);

    async function createCaso(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        try {
            const res = await fetch("/api/admin/ia/evals/casos", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: form.texto,
                    categoriaEsperada: form.categoriaEsperada,
                    secundariaEsperada: form.secundariaEsperada || undefined,
                    ruido: form.ruido,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error creando caso");
            setMessage({
                type: "success",
                text: `Caso creado. El fixture cambió a v${data.fixtureVersion}. Las métricas anteriores corresponden a v${data.fixtureVersion - 1}; corré el eval para establecer la nueva línea de base.`,
            });
            setForm({ texto: "", categoriaEsperada: "", secundariaEsperada: "", ruido: false });
            loadCasos();
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        }
    }

    async function disableCaso(id: string) {
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/ia/evals/casos/${id}/desactivar`, {
                method: "PATCH",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error desactivando caso");
            setMessage({
                type: "success",
                text: `Caso desactivado. El fixture cambió a v${data.fixtureVersion}. Corré el eval para establecer la nueva línea de base.`,
            });
            loadCasos();
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        }
    }

    return (
        <div className="space-y-6">
            {message && (
                <GlassCard className={`border-l-4 p-4 ${message.type === "success" ? "border-l-green-500" : "border-l-red-500"}`}>
                    <p className={message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {message.text}
                    </p>
                </GlassCard>
            )}

            <GlassCard className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-body">Alta de caso</h3>
                <form onSubmit={createCaso} className="space-y-4">
                    <textarea
                        value={form.texto}
                        onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                        placeholder="Texto del caso de evaluación..."
                        rows={3}
                        className="w-full resize-y rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                        maxLength={4000}
                        required
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                        <Select
                            label="Categoría esperada"
                            value={form.categoriaEsperada}
                            onChange={(e) => setForm((f) => ({ ...f, categoriaEsperada: e.target.value }))}
                            options={[{ value: "", label: "Seleccionar..." }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                            required
                        />
                        <Select
                            label="Secundaria (opcional)"
                            value={form.secundariaEsperada}
                            onChange={(e) => setForm((f) => ({ ...f, secundariaEsperada: e.target.value }))}
                            options={[{ value: "", label: "Ninguna" }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                        />
                        <label className="flex items-center gap-2 text-sm text-body">
                            <input
                                type="checkbox"
                                checked={form.ruido}
                                onChange={(e) => setForm((f) => ({ ...f, ruido: e.target.checked }))}
                            />
                            Ruido
                        </label>
                    </div>
                    <Button type="submit">Crear caso</Button>
                </form>
            </GlassCard>

            <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-body">Casos</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Select
                        label="Categoría"
                        value={filters.categoria}
                        onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value, page: "" }))}
                        options={[{ value: "", label: "Todas" }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))]}
                    />
                    <Select
                        label="Ruido"
                        value={filters.ruido}
                        onChange={(e) => setFilters((f) => ({ ...f, ruido: e.target.value }))}
                        options={[
                            { value: "", label: "Todos" },
                            { value: "true", label: "Sí" },
                            { value: "false", label: "No" },
                        ]}
                    />
                    <Select
                        label="Fuente"
                        value={filters.fuente}
                        onChange={(e) => setFilters((f) => ({ ...f, fuente: e.target.value }))}
                        options={[{ value: "", label: "Todas" }, ...FUENTES.map((c) => ({ value: c, label: c }))]}
                    />
                    <Select
                        label="Activo"
                        value={filters.activo}
                        onChange={(e) => setFilters((f) => ({ ...f, activo: e.target.value }))}
                        options={[
                            { value: "", label: "Todos" },
                            { value: "true", label: "Sí" },
                            { value: "false", label: "No" },
                        ]}
                    />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {Object.entries(conteos).map(([cat, count]) => (
                        <Badge key={cat} variant="neutral">
                            {cat}: {count}
                        </Badge>
                    ))}
                </div>

                {loading ? (
                    <p className="mt-4 text-sm text-muted">Cargando...</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {casos.map((c) => (
                            <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge>{c.categoriaEsperada}</Badge>
                                    {c.secundariaEsperada && <Badge variant="info">{c.secundariaEsperada}</Badge>}
                                    {c.ruido && <Badge variant="warning">ruido</Badge>}
                                    <Badge variant={c.activo ? "success" : "danger"}>{c.activo ? "activo" : "inactivo"}</Badge>
                                    <span className="text-xs text-muted">v{c.fixtureVersion}</span>
                                </div>
                                <p className="mt-2 text-muted line-clamp-2">{c.texto}</p>
                                {c.activo && (
                                    <Button variant="ghost" className="mt-2 text-xs" onClick={() => disableCaso(c.id)}>
                                        Desactivar
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 flex gap-2">
                    <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                        Anterior
                    </Button>
                    <span className="self-center text-sm text-muted">
                        Página {page} de {totalPages}
                    </span>
                    <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                        Siguiente
                    </Button>
                </div>
            </GlassCard>
        </div>
    );
}

function HistorialTab() {
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
                        const metrics = (run.resultadoJson?.metrics || {}) as RunMetrics;
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
