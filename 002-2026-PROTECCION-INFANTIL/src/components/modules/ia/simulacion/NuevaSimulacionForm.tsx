"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { parsearArchivoSimulacion } from "@/lib/simulacion/parser";
import type { OllamaModel } from "./types";

interface NuevaSimulacionFormProps {
    onBack: () => void;
    onCreated: () => void;
}

export function NuevaSimulacionForm({ onBack, onCreated }: NuevaSimulacionFormProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [modelo, setModelo] = useState("");
    const [archivo, setArchivo] = useState("");
    const [formato, setFormato] = useState<"csv" | "json">("csv");
    const [errores, setErrores] = useState<Array<{ indice: number; campo?: string; mensaje: string }>>([]);
    const [totalCasos, setTotalCasos] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        async function init() {
            try {
                const res = await fetch("/api/admin/ia/modelos", { credentials: "include" });
                const data = await res.json();
                const disponibles = (data.models || []).filter((m: OllamaModel) => !m.esEmbedding);
                setModels(disponibles);
                if (disponibles.length > 0) setModelo(`${disponibles[0].name}:${disponibles[0].tag}`);
            } catch {
                setMessage({ type: "error", text: "Error cargando modelos disponibles" });
            }
        }
        init();

        const repeat = localStorage.getItem("simulacion_repeat_casos");
        if (repeat) {
            try {
                const casos = JSON.parse(repeat);
                if (Array.isArray(casos) && casos.length > 0) {
                    setFormato("json");
                    setArchivo(JSON.stringify(casos, null, 2));
                    setTotalCasos(casos.length);
                    setErrores([]);
                    setStep(2);
                }
            } catch {
                // ignore
            }
            localStorage.removeItem("simulacion_repeat_casos");
        }
    }, []);

    const estimacionMinutos = useMemo(() => {
        const segundosPorCaso = modelo.includes("32b") || modelo.includes("70b") ? 60 : 7;
        return Math.max(1, Math.ceil((totalCasos * segundosPorCaso) / 60));
    }, [modelo, totalCasos]);

    async function validar() {
        setErrores([]);
        setMessage(null);
        if (!archivo.trim()) {
            setMessage({ type: "error", text: "Cargue un archivo CSV o JSON" });
            return;
        }
        const parseo = parsearArchivoSimulacion(archivo, formato);
        if (!parseo.ok) {
            setErrores(parseo.errores || []);
            setMessage({ type: "error", text: parseo.mensaje || "Error validando el archivo" });
            return;
        }
        setTotalCasos(parseo.casos?.length || 0);
        setStep(2);
    }

    async function lanzar() {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/ia/simulaciones", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modelo, archivo, formato }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error creando simulación");
            setStep(3);
            setMessage({
                type: "success",
                text: `Simulación encolada. Duración estimada: ${estimacionMinutos} min. ID: ${data.runId}`,
            });
            setTimeout(onCreated, 2000);
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
        } finally {
            setLoading(false);
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "json") setFormato("json");
        else setFormato("csv");
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = String(ev.target?.result || "");
            setArchivo(text);
            setErrores([]);
            setTotalCasos(0);
            setStep(1);
        };
        reader.readAsText(file);
    }

    return (
        <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-body">Nueva simulación</h3>
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
                    <p className="text-sm text-muted">Paso 1 de 2 — Cargar set de casos</p>
                    <Input
                        type="file"
                        label="Archivo CSV o JSON"
                        accept=".csv,.json"
                        onChange={handleFileChange}
                    />
                    {archivo && (
                        <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-800/50">
                            <p>Formato detectado: {formato.toUpperCase()}</p>
                            <p className="text-xs">Tamaño: {archivo.length} caracteres</p>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button onClick={validar} disabled={!archivo}>
                            Validar casos
                        </Button>
                    </div>
                    {errores.length > 0 && (
                        <div className="max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/20">
                            <p className="font-medium text-red-700 dark:text-red-300">Errores por línea:</p>
                            <ul className="mt-2 space-y-1">
                                {errores.slice(0, 20).map((err, i) => (
                                    <li key={i} className="text-red-600 dark:text-red-400">
                                        Fila {err.indice}: {err.campo ? `[${err.campo}] ` : ""}
                                        {err.mensaje}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <p className="text-sm text-muted">Paso 2 de 2 — Configurar y lanzar</p>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-800/50">
                        <p>Casos válidos: {totalCasos}</p>
                    </div>
                    <Select
                        label="Modelo de clasificación"
                        value={modelo}
                        onChange={(e) => setModelo(e.target.value)}
                        options={[
                            { value: "", label: "Seleccionar modelo..." },
                            ...models.map((m) => ({ value: `${m.name}:${m.tag}`, label: `${m.name}:${m.tag}` })),
                        ]}
                    />
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-800/50">
                        Estimación: ~{estimacionMinutos} minutos con {modelo || "el modelo seleccionado"}.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setStep(1)}>
                            Atrás
                        </Button>
                        <Button onClick={lanzar} isLoading={loading} disabled={!modelo}>
                            Lanzar simulación
                        </Button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-4">
                    <p className="text-green-600 dark:text-green-400 text-sm">Simulación lanzada. Volviendo al listado...</p>
                </div>
            )}
        </GlassCard>
    );
}
