"use client";

import { useState, useEffect } from "react";
import { BarChart } from "@/components/modules/BarChart";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    OTRO: "Otro",
};

const PIPELINE_STEPS = [
    {
        id: "embedding",
        label: "Embedding",
        description:
            "El texto se convierte en un vector numérico con el modelo de embeddings. Ese vector se usa para buscar ejemplos similares en el dataset de correcciones.",
    },
    {
        id: "rag",
        label: "RAG",
        description:
            "Recuperación de ejemplos corregidos por administradores que son semánticamente similares al texto de entrada. Se inyectan en el prompt como contexto.",
    },
    {
        id: "votacion",
        label: "Votación",
        description:
            "El modelo de clasificación vota N veces sobre la categoría. La categoría ganadora es la moda. La confianza es la proporción de votos que recibió.",
    },
    {
        id: "pii",
        label: "PII",
        description:
            "Se detectan datos personales de menores o terceros inocentes combinando patrones determinísticos y un modelo LLM. El agresor nunca se marca como PII.",
    },
    {
        id: "guardas",
        label: "Guardas",
        description:
            "Reglas determinísticas de seguridad: DOXING, keywords críticas y ráfagas. Nunca reclasifican; solo escalan a revisión manual o priorizan.",
    },
    {
        id: "decision",
        label: "Decisión",
        description:
            "Si la confianza supera el umbral configurado el reporte queda CLASIFICADO; de lo contrario va a REVISION_MANUAL. Las guardas pueden forzar revisión manual.",
    },
];

function PipelineDiagram() {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {PIPELINE_STEPS.map((step, idx) => (
                    <div key={step.id} className="flex items-center gap-2">
                        <button
                            onClick={() => setSelected(selected === step.id ? null : step.id)}
                            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                selected === step.id
                                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-cyan-400 dark:bg-sky-950/50 dark:text-cyan-300"
                                    : "border-slate-200 bg-white/70 text-body hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-500"
                            }`}
                        >
                            {idx + 1}. {step.label}
                        </button>
                        {idx < PIPELINE_STEPS.length - 1 && (
                            <span className="text-subtle">→</span>
                        )}
                    </div>
                ))}
            </div>
            {selected && (
                <GlassCard className="p-4">
                    <h4 className="font-semibold text-body">
                        {PIPELINE_STEPS.find((s) => s.id === selected)?.label}
                    </h4>
                    <p className="mt-1 text-sm text-muted">
                        {PIPELINE_STEPS.find((s) => s.id === selected)?.description}
                    </p>
                </GlassCard>
            )}
        </div>
    );
}

function VoteDistributionDemo() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="p-4">
                <h4 className="mb-2 text-sm font-semibold text-body">Unánime (5/5)</h4>
                <BarChart
                    ariaLabel="Distribución de votos unánime"
                    data={[
                        { label: "EXTORSION", value: 5 },
                        { label: "OTRO", value: 0 },
                    ]}
                />
                <p className="mt-3 text-xs text-muted">
                    Todos los votos coinciden. Con umbral 1.0 el resultado es CLASIFICADO.
                </p>
            </GlassCard>
            <GlassCard className="p-4">
                <h4 className="mb-2 text-sm font-semibold text-body">Disperso (3/2)</h4>
                <BarChart
                    ariaLabel="Distribución de votos disperso"
                    data={[
                        { label: "EXTORSION", value: 3 },
                        { label: "SOL_MAT", value: 2 },
                    ]}
                />
                <p className="mt-3 text-xs text-muted">
                    La moda gana pero sin unanimidad. Con umbral 1.0 va a REVISION_MANUAL.
                </p>
            </GlassCard>
        </div>
    );
}

function ConfidenceGauge({ confianza, umbral }: { confianza: number; umbral: number }) {
    const radius = 70;
    const stroke = 12;
    const normalized = Math.min(Math.max(confianza, 0), 1);
    const circumference = Math.PI * radius;
    const offset = circumference * (1 - normalized);

    return (
        <GlassCard className="flex flex-col items-center p-6">
            <div className="relative h-40 w-48">
                <svg viewBox="0 0 180 110" className="h-full w-full">
                    <path
                        d="M 20 100 A 70 70 0 0 1 160 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        className="text-slate-200 dark:text-slate-700"
                    />
                    <path
                        d="M 20 100 A 70 70 0 0 1 160 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={confianza >= umbral ? "text-green-500" : "text-amber-500"}
                    />
                    {/* Marcador del umbral */}
                    <line
                        x1={90 - radius * Math.cos(Math.PI * umbral)}
                        y1={100 - radius * Math.sin(Math.PI * umbral)}
                        x2={90 - (radius - stroke) * Math.cos(Math.PI * umbral)}
                        y2={100 - (radius - stroke) * Math.sin(Math.PI * umbral)}
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-slate-500"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                    <span className="text-2xl font-bold text-body">{(confianza * 100).toFixed(0)}%</span>
                    <span className="text-xs text-muted">umbral {umbral}</span>
                </div>
            </div>
            <Badge variant={confianza >= umbral ? "success" : "warning"} className="mt-2">
                {confianza >= umbral ? "CLASIFICADO" : "REVISION_MANUAL"}
            </Badge>
        </GlassCard>
    );
}

function MetricBarsByCategory() {
    const [data, setData] = useState<
        { categoria: string; confirmadas: number; corregidas: number; precisionObservada: number | null }[] | null
    >(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/estadisticas", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((res) => setData(res?.precisionPorCategoria || null))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />;
    if (!data || data.length === 0) {
        return <p className="text-sm text-muted">Aún no hay correcciones ni confirmaciones para calcular precisión observada.</p>;
    }

    const chartData = data.map((d) => ({
        label: CATEGORIA_LABELS[d.categoria] || d.categoria,
        value: d.precisionObservada === null ? 0 : Math.round(d.precisionObservada * 100),
    }));

    return (
        <GlassCard className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-body">Precisión observada por categoría (%)</h4>
            <BarChart ariaLabel="Precisión observada por categoría" data={chartData} />
            <p className="mt-2 text-xs text-muted">
                Basada en confirmaciones y correcciones de administradores. Una categoría necesita datos suficientes para ser confiable.
            </p>
        </GlassCard>
    );
}

export function IaDocsPanel() {
    return (
        <div className="space-y-8">
            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-body">Flujo del pipeline</h2>
                <p className="text-sm text-muted">
                    Hacé clic en cada etapa para ver qué hace. El pipeline completo se ejecuta en el playground sin guardar nada.
                </p>
                <PipelineDiagram />
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold text-body">Distribución de votos</h2>
                <p className="text-sm text-muted">
                    La confianza es la proporción de votos que recibió la categoría ganadora. Con umbral 1.0 se exige unanimidad.
                </p>
                <VoteDistributionDemo />
            </section>

            <section className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-body">Umbral de confianza</h2>
                    <p className="text-sm text-muted">
                        El gauge muestra dónde cae la confianza respecto al umbral configurado. A mayor umbral, más reportes van a revisión manual.
                    </p>
                    <ConfidenceGauge confianza={0.8} umbral={1.0} />
                </div>
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-body">Precisión observada</h2>
                    <p className="text-sm text-muted">
                        Esta métrica guía cuándo se puede bajar la tasa de revisión manual sin aumentar errores silenciosos.
                    </p>
                    <MetricBarsByCategory />
                </div>
            </section>
        </div>
    );
}
