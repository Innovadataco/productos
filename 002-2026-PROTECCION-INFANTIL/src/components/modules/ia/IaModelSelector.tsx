"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface OllamaModel {
    name: string;
    tag: string;
    size: number;
    modifiedAt: string;
    esEmbedding: boolean;
}

interface ParamValue {
    clave: string;
    valor: string;
}

export function IaModelSelector() {
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [params, setParams] = useState<ParamValue[]>([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [ollamaUrl, setOllamaUrl] = useState("");
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    async function fetchModels() {
        setLoadingModels(true);
        try {
            const res = await fetch("/api/admin/ia/modelos", { credentials: "include" });
            const data = await res.json();
            if (res.ok) {
                setModels(data.models || []);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error listando modelos" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de conexión con Ollama" });
        } finally {
            setLoadingModels(false);
        }
    }

    async function fetchParam(clave: string): Promise<string> {
        const res = await fetch(`/api/config/parametros/${encodeURIComponent(clave)}`, { credentials: "include" });
        if (!res.ok) return "";
        const data = await res.json();
        return data.valor ?? "";
    }

    async function fetchParams() {
        try {
            const [modelo, url] = await Promise.all([
                fetchParam("reportes.classification_model"),
                fetchParam("system.ollama_base_url"),
            ]);
            setParams([
                { clave: "reportes.classification_model", valor: modelo },
                { clave: "system.ollama_base_url", valor: url },
            ]);
            setSelectedModel(modelo);
            setOllamaUrl(url);
        } catch {
            setMessage({ type: "error", text: "Error cargando parámetros" });
        }
    }

    useEffect(() => {
        Promise.all([fetchModels(), fetchParams()]);
    }, []);

    const classificationModels = models.filter((m) => !m.esEmbedding);
    const embeddingModels = models.filter((m) => m.esEmbedding);
    const activeModelLabel = classificationModels.find((m) => `${m.name}:${m.tag}` === selectedModel);

    async function testConnection() {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch("/api/admin/ia/ollama/probar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: ollamaUrl }),
            });
            const data = await res.json();
            if (res.ok) {
                setTestResult({
                    ok: true,
                    message: `Conexión OK. Modelos de clasificación: ${data.modelosClasificacion.length}. Embeddings: ${data.modelosEmbedding.length}.`,
                });
            } else {
                setTestResult({ ok: false, message: data?.error?.message || "Error de conexión" });
            }
        } catch {
            setTestResult({ ok: false, message: "No se pudo conectar con Ollama" });
        } finally {
            setTesting(false);
        }
    }

    async function saveParam(clave: string, valor: string) {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/config/parametros/${encodeURIComponent(clave)}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error?.message || "Error guardando");
            }
            setParams((prev) => prev.map((p) => (p.clave === clave ? { ...p, valor } : p)));
            setMessage({ type: "success", text: "Guardado" });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error";
            setMessage({ type: "error", text: msg });
        } finally {
            setSaving(false);
        }
    }

    function formatBytes(bytes: number) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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

            <GlassCard className="p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-body">URL de Ollama</h3>
                    <p className="text-sm text-muted">Solo se permiten URLs locales o de red privada (R2).</p>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <Input
                        label="URL base de Ollama"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="md:flex-1"
                    />
                    <Button onClick={testConnection} disabled={testing || !ollamaUrl.trim()} variant="secondary">
                        {testing ? "Probando..." : "Probar conexión"}
                    </Button>
                    <Button onClick={() => saveParam("system.ollama_base_url", ollamaUrl)} disabled={saving || !ollamaUrl.trim()}>
                        Guardar URL
                    </Button>
                </div>

                {testResult && (
                    <div className={`text-sm ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {testResult.message}
                    </div>
                )}
            </GlassCard>

            <GlassCard className="p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-body">Modelo de clasificación</h3>
                    <p className="text-sm text-muted">Seleccione el modelo activo para el procesamiento de reportes.</p>
                </div>

                {loadingModels ? (
                    <p className="text-sm text-muted">Cargando modelos...</p>
                ) : classificationModels.length === 0 ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        No se encontraron modelos de clasificación instalados. Verifique que Ollama esté corriendo y que haya modelos descargados.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <Select
                            label="Modelo activo"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            options={[
                                { value: "", label: "Seleccionar modelo..." },
                                ...classificationModels.map((m) => ({
                                    value: `${m.name}:${m.tag}`,
                                    label: `${m.name}:${m.tag} (${formatBytes(m.size)})`,
                                })),
                            ]}
                        />

                        {selectedModel && (
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="info">{selectedModel}</Badge>
                                {!activeModelLabel && <Badge variant="warning">No confirmado en Ollama</Badge>}
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        window.location.href = `/dashboard/admin/ia?tab=playground&modelo_clasificacion=${encodeURIComponent(selectedModel)}`;
                                    }}
                                    disabled={!selectedModel}
                                >
                                    Probar con este modelo
                                </Button>
                                <Button onClick={() => saveParam("reportes.classification_model", selectedModel)} disabled={saving || !selectedModel}>
                                    Guardar como activo
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </GlassCard>

            {embeddingModels.length > 0 && (
                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold text-body mb-2">Modelos de embedding detectados</h3>
                    <div className="flex flex-wrap gap-2">
                        {embeddingModels.map((m) => (
                            <Badge key={`${m.name}:${m.tag}`} variant="neutral">
                                {m.name}:{m.tag}
                            </Badge>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-muted">Los modelos de embedding se excluyen del selector de clasificación.</p>
                </GlassCard>
            )}
        </div>
    );
}
