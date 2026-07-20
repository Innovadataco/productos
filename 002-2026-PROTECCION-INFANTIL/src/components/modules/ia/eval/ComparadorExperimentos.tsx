"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPct } from "./format";
import type { Experimento, RunMetrics, CompareResult } from "./types";

interface ComparadorExperimentosProps {
    experiments: Experimento[];
    onBack: () => void;
}

export function ComparadorExperimentos({ experiments, onBack }: ComparadorExperimentosProps) {
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
