"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { formatCategoria } from "@/lib/labels";

interface Pregunta {
    texto: string;
    activo: boolean;
}

interface ConfigRubricaResponse {
    preguntas: Record<string, Pregunta[]>;
    modelos: string[];
    temperatura: number;
    umbralPresencia: number;
    modeloEmbudo: string;
}

type Message = { type: "success" | "error"; text: string } | null;

/**
 * Tab "Rúbrica" del Centro de Control IA (spec 090, US3-bis).
 * Edita las preguntas factuales por categoría y los parámetros operativos
 * del motor de rúbrica (ia.rubrica.*).
 */
export function RubricaTab() {
    const [config, setConfig] = useState<ConfigRubricaResponse | null>(null);
    const [categoria, setCategoria] = useState("");
    const [preguntasEdit, setPreguntasEdit] = useState<Pregunta[]>([]);
    const [configForm, setConfigForm] = useState({ modelos: "", temperatura: "", umbralPresencia: "", modeloEmbudo: "" });
    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [message, setMessage] = useState<Message>(null);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ia/rubrica", { credentials: "include" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error cargando la rúbrica");
            const cfg = data as ConfigRubricaResponse;
            setConfig(cfg);
            const categorias = Object.keys(cfg.preguntas).sort();
            setCategoria((actual) => (actual && cfg.preguntas[actual] ? actual : (categorias[0] ?? "")));
            setConfigForm({
                modelos: cfg.modelos.join(", "),
                temperatura: String(cfg.temperatura),
                umbralPresencia: String(cfg.umbralPresencia),
                modeloEmbudo: cfg.modeloEmbudo,
            });
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error de red" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (config && categoria) {
            setPreguntasEdit((config.preguntas[categoria] ?? []).map((p) => ({ ...p })));
        }
    }, [config, categoria]);

    async function guardarSet() {
        setMessage(null);
        setGuardando(true);
        try {
            const res = await fetch("/api/admin/ia/rubrica/preguntas", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoria, preguntas: preguntasEdit }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error guardando el set");
            setConfig((cfg) => (cfg ? { ...cfg, preguntas: { ...cfg.preguntas, [categoria]: preguntasEdit } } : cfg));
            setMessage({ type: "success", text: `Set de ${formatCategoria(categoria)} guardado (${preguntasEdit.length} preguntas).` });
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        } finally {
            setGuardando(false);
        }
    }

    async function guardarConfig() {
        setMessage(null);
        setGuardando(true);
        try {
            const modelos = configForm.modelos
                .split(",")
                .map((m) => m.trim())
                .filter((m) => m.length > 0);
            const res = await fetch("/api/admin/ia/rubrica/config", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modelos,
                    temperatura: parseFloat(configForm.temperatura),
                    umbralPresencia: parseFloat(configForm.umbralPresencia),
                    modeloEmbudo: configForm.modeloEmbudo.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error guardando la configuración");
            setMessage({ type: "success", text: "Configuración de la rúbrica guardada." });
            load();
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        } finally {
            setGuardando(false);
        }
    }

    const categorias = config ? Object.keys(config.preguntas).sort() : [];

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
                <h3 className="text-lg font-semibold text-body">Preguntas por categoría</h3>
                <p className="text-xs text-muted">
                    Un modelo marca una categoría solo si TODAS sus preguntas activas se cumplen con evidencia clara.
                </p>
                {loading ? (
                    <p className="text-sm text-muted">Cargando...</p>
                ) : (
                    <>
                        <Select
                            label="Categoría"
                            value={categoria}
                            onChange={(e) => setCategoria(e.target.value)}
                            options={categorias.map((c) => ({ value: c, label: formatCategoria(c) }))}
                        />
                        <div className="space-y-3">
                            {preguntasEdit.map((p, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={p.activo}
                                        onChange={(e) =>
                                            setPreguntasEdit((prev) =>
                                                prev.map((q, j) => (j === i ? { ...q, activo: e.target.checked } : q))
                                            )
                                        }
                                        aria-label={`Pregunta ${i + 1} activa`}
                                        className="shrink-0"
                                    />
                                    <input
                                        type="text"
                                        value={p.texto}
                                        maxLength={300}
                                        onChange={(e) =>
                                            setPreguntasEdit((prev) =>
                                                prev.map((q, j) => (j === i ? { ...q, texto: e.target.value } : q))
                                            )
                                        }
                                        aria-label={`Texto de la pregunta ${i + 1}`}
                                        className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500 dark:focus:ring-sky-900"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setPreguntasEdit((prev) => [...prev, { texto: "", activo: true }])}
                                disabled={preguntasEdit.length >= 10}
                            >
                                Agregar pregunta
                            </Button>
                            <Button onClick={guardarSet} disabled={guardando || !categoria}>
                                Guardar set
                            </Button>
                        </div>
                    </>
                )}
            </GlassCard>

            <GlassCard className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-body">Configuración</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label="Modelos (separados por comas)"
                        value={configForm.modelos}
                        onChange={(e) => setConfigForm((f) => ({ ...f, modelos: e.target.value }))}
                        placeholder="gemma2:27b, qwen2.5:14b"
                    />
                    <Input
                        label="Modelo de embudo"
                        value={configForm.modeloEmbudo}
                        onChange={(e) => setConfigForm((f) => ({ ...f, modeloEmbudo: e.target.value }))}
                        placeholder="qwen2.5:14b"
                    />
                    <Input
                        label="Umbral de presencia (0-1)"
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={configForm.umbralPresencia}
                        onChange={(e) => setConfigForm((f) => ({ ...f, umbralPresencia: e.target.value }))}
                    />
                    <Input
                        label="Temperatura (0-2)"
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={configForm.temperatura}
                        onChange={(e) => setConfigForm((f) => ({ ...f, temperatura: e.target.value }))}
                    />
                </div>
                <Button onClick={guardarConfig} disabled={guardando || loading}>
                    Guardar configuración
                </Button>
            </GlassCard>
        </div>
    );
}
