"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "../eval/MetricCard";
import { formatPct } from "../eval/format";
import type { MetricasSimulacionUI } from "./types";

interface MetricasSimulacionProps {
    metricas: MetricasSimulacionUI;
}

export function MetricasSimulacion({ metricas }: MetricasSimulacionProps) {
    const categorias = Object.entries(metricas.porCategoria).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Accuracy" value={metricas.accuracy} />
                <MetricCard label="Aciertos" value={metricas.aciertos / (metricas.aciertos + metricas.fallos || 1)} />
                <MetricCard label="Desempate" value={metricas.usoDesempate?.porcentaje ?? 0} />
                <MetricCard label="Latencia prom." value={(metricas.latenciaPromedioMs ?? 0) / 1000} />
                <MetricCard label="Latencia p50" value={metricas.latenciaP50Ms / 1000} />
                <MetricCard label="Latencia p95" value={metricas.latenciaP95Ms / 1000} />
            </div>

            {categorias.length > 0 && (
                <GlassCard className="p-5">
                    <h4 className="font-semibold text-body">Precisión / Recall por categoría</h4>
                    <div className="mt-3 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2 px-2 text-left text-muted">Categoría</th>
                                    <th className="py-2 px-2 text-left text-muted">Support</th>
                                    <th className="py-2 px-2 text-left text-muted">Precision</th>
                                    <th className="py-2 px-2 text-left text-muted">Recall</th>
                                    <th className="py-2 px-2 text-left text-muted">F1</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorias.map(([cat, m]) => (
                                    <tr key={cat} className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="py-2 px-2 font-medium text-body">{cat}</td>
                                        <td className="py-2 px-2 text-muted">{m.support}</td>
                                        <td className="py-2 px-2 text-muted">{formatPct(m.precision)}</td>
                                        <td className="py-2 px-2 text-muted">{formatPct(m.recall)}</td>
                                        <td className="py-2 px-2 text-muted">{formatPct(m.f1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {metricas.matrizConfusion.length > 0 && (
                <GlassCard className="p-5">
                    <h4 className="font-semibold text-body">Matriz de confusión</h4>
                    <div className="mt-3 overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2 px-2 text-left text-muted">Esperada \ Asignada</th>
                                    <th className="py-2 px-2 text-left text-muted">Categoría</th>
                                    <th className="py-2 px-2 text-left text-muted">Casos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metricas.matrizConfusion.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                                        <td className="py-2 px-2 font-medium text-body">{row.esperado}</td>
                                        <td className="py-2 px-2 text-muted">{row.asignado}</td>
                                        <td className="py-2 px-2">
                                            <Badge variant={row.esperado === row.asignado ? "success" : "warning"}>{row.count}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {metricas.falsosNegativos.length > 0 && (
                <GlassCard className="p-5">
                    <h4 className="font-semibold text-body">Falsos negativos críticos</h4>
                    <div className="mt-3 max-h-96 overflow-auto space-y-3">
                        {metricas.falsosNegativos.slice(0, 20).map((fn) => (
                            <div key={fn.indice} className="rounded-lg border border-red-200 p-3 dark:border-red-900">
                                <div className="flex gap-2 text-sm">
                                    <span className="text-muted">#{fn.indice}</span>
                                    <Badge variant="danger">Esperado: {fn.esperado}</Badge>
                                    <Badge variant="warning">Asignado: {fn.asignado}</Badge>
                                    <span className="text-muted">confianza: {fn.confianza.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            <GlassCard className="p-5">
                <h4 className="font-semibold text-body">Distribución de estados</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(metricas.distribucionEstados).map(([estado, count]) => (
                        <Badge key={estado} variant="neutral">
                            {estado}: {count}
                        </Badge>
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}
