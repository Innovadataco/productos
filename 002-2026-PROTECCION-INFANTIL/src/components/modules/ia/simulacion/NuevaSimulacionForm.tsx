"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
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
    const [modelos, setModelos] = useState<string[]>([]);
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
                if (disponibles.length > 0) setModelos([`${disponibles[0].name}:${disponibles[0].tag}`]);
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
        const segundos = modelos.reduce((acc, m) => {
            const segundosPorCaso = m.includes("32b") || m.includes("70b") ? 60 : 7;
            return acc + totalCasos * segundosPorCaso;
        }, 0);
        return Math.max(1, Math.ceil(segundos / 60));
    }, [modelos, totalCasos]);

    function toggleModelo(valor: string) {
        setModelos((prev) => (prev.includes(valor) ? prev.filter((m) => m !== valor) : [...prev, valor]));
    }

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
                body: JSON.stringify({ modelos, archivo, formato }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error creando simulación");
            setStep(3);
            const n = Array.isArray(data.runIds) ? data.runIds.length : 1;
            setMessage({
                type: "success",
                text: `${n} simulación(es) encolada(s) en secuencia. Duración estimada total: ${estimacionMinutos} min.`,
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
                    <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted dark:bg-slate-800/50 space-y-1">
                        <p className="font-medium">Formato esperado:</p>
                        <p>CSV: texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada</p>
                        <p>JSON: array con esos mismos campos (edadVictima y categoriaEsperada opcionales).</p>
                    </div>
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
                    <fieldset>
                        <legend className="block text-sm font-medium text-body mb-1.5">
                            Modelos de clasificación (se ejecutan en secuencia)
                        </legend>
                        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                            {models.map((m) => {
                                const valor = `${m.name}:${m.tag}`;
                                return (
                                    <label key={valor} className="flex items-center gap-2 text-sm text-body">
                                        <input
                                            type="checkbox"
                                            checked={modelos.includes(valor)}
                                            onChange={() => toggleModelo(valor)}
                                            className="h-4 w-4"
                                        />
                                        {valor}
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted dark:bg-slate-800/50">
                        Estimación total: ~{estimacionMinutos} minutos con {modelos.length} modelo(s) en secuencia.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setStep(1)}>
                            Atrás
                        </Button>
                        <Button onClick={lanzar} isLoading={loading} disabled={modelos.length === 0}>
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
