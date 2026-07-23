"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import type { SimulacionRun, ComparacionResultado, ComparacionResultadoCaso } from "./types";

interface ComparadorSimulacionesProps {
    runs: SimulacionRun[];
    onBack: () => void;
    onRepeat: (casosJson: unknown) => void;
}

export function ComparadorSimulaciones({ runs, onBack, onRepeat }: ComparadorSimulacionesProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [result, setResult] = useState<ComparacionResultado | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function comparar() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/ia/simulaciones/comparar", {
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

    function repetirConOtroModelo(runId: string) {
        const run = runs.find((r) => r.id === runId);
        if (run?.casosJson) {
            onRepeat(run.casosJson);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-body">Comparador de simulaciones</h3>
                <Button variant="ghost" onClick={onBack}>
                    Volver
                </Button>
            </div>

            <GlassCard className="p-5">
                <p className="text-sm text-muted mb-3">Seleccione 2 a 5 simulaciones completadas.</p>
                <div className="space-y-2">
                    {runs.map((run) => (
                        <label key={run.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(run.id)}
                                onChange={() => toggle(run.id)}
                                className="h-4 w-4"
                            />
                            <span className="text-sm text-body">{run.id.slice(0, 8)}</span>
                            <span className="text-xs text-muted">{run.modelo}</span>
                            <Badge variant={run.estado === "COMPLETADA" ? "success" : "warning"}>{run.estado}</Badge>
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

            {result && (
                <GlassCard className="p-5 overflow-auto">
                    <h4 className="font-semibold text-body mb-3">Resumen</h4>
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="py-2 text-left text-muted">Métrica</th>
                                {result.runs.map((r) => (
                                    <th key={r.id} className="py-2 px-3 text-left text-body">
                                        {r.modelo} <span className="text-xs text-muted">({r.id.slice(0, 8)})</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { label: "Errores silenciosos", key: "erroresSilenciosos" as const },
                                { label: "ESPS", key: "esps" as const },
                                { label: "Subestimaciones", key: "subestimaciones" as const },
                                { label: "Accuracy", key: "accuracy" as const },
                                { label: "Aciertos", key: "aciertos" as const },
                                { label: "Fallos", key: "fallos" as const },
                                { label: "Latencia p50 (ms)", key: "latenciaP50Ms" as const },
                                { label: "Latencia p95 (ms)", key: "latenciaP95Ms" as const },
                            ].map((row) => (
                                <tr key={row.key} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-2 text-muted">{row.label}</td>
                                    {result.runs.map((r) => (
                                        <td key={r.id} className="py-2 px-3 font-medium text-body">
                                            {row.key === "accuracy" ? `${(r[row.key] * 100).toFixed(1)}%` : r[row.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {result.advertencia && (
                        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{result.advertencia}</p>
                    )}

                    <h4 className="font-semibold text-body mb-3 mt-6">Comparación por índice</h4>
                    <div className="max-h-96 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2 px-2 text-left text-muted">#</th>
                                    <th className="py-2 px-2 text-left text-muted">Esperada</th>
                                    {result.runs.map((r) => (
                                        <th key={r.id} className="py-2 px-2 text-left text-muted">
                                            {r.modelo}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.filas.map((fila) => {
                                    const resultados = fila.resultados;
                                    const esperada = resultados[0]?.categoriaEsperada ?? "N/A";
                                    return (
                                        <tr key={fila.indice} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 px-2 text-body">{fila.indice}</td>
                                            <td className="py-2 px-2">
                                                <Badge variant="neutral">{esperada}</Badge>
                                            </td>
                                            {result.runs.map((run) => {
                                                const r = resultados.find((x) => x.runId === run.id);
                                                return (
                                                    <td key={run.id} className="py-2 px-2">
                                                        {r ? (
                                                            <div className="space-y-1">
                                                                <Badge variant={r.acierto ? "success" : r.acierto === false ? "danger" : "neutral"}>
                                                                    {r.categoriaAsignada}
                                                                </Badge>
                                                                <p className="text-xs text-muted">{r.acierto === null ? "N/A" : r.acierto ? "Acierto" : "Fallo"}</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex gap-2">
                        {result.runs.map((r) => (
                            <Button key={r.id} variant="outline" onClick={() => repetirConOtroModelo(r.id)}>
                                Repetir {r.modelo}
                            </Button>
                        ))}
                    </div>
                </GlassCard>
            )}
        </div>
    );
}
