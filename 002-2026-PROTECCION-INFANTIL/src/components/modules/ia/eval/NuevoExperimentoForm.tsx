"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { formatDuration } from "./format";
import type { OllamaModel } from "./types";

interface NuevoExperimentoFormProps {
    onBack: () => void;
    onCreated: () => void;
}

export function NuevoExperimentoForm({ onBack, onCreated }: NuevoExperimentoFormProps) {
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
