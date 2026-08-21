"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCategoria, formatDuracion, formatPorcentaje } from "../utils";
import type { Metricas } from "../types";

export function MetricasCards({ metricas }: { metricas: Metricas }) {
    const categoriaTop = useMemo(() => {
        const ordenadas = [...metricas.casosPorCategoria].sort((a, b) => b.total - a.total);
        return ordenadas[0] || null;
    }, [metricas.casosPorCategoria]);

    return (
        <section className="space-y-4" aria-labelledby="metricas-title">
            <h2 id="metricas-title" className="text-lg font-semibold text-body">
                Métricas de productividad
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricaCard
                    label="Tiempo medio resolución (30 días)"
                    value={
                        metricas.tiempoMedioResolucionMs !== null
                            ? formatDuracion(metricas.tiempoMedioResolucionMs)
                            : "—"
                    }
                />
                <MetricaCard label="Resueltos 7 días" value={String(metricas.casosResueltos7d)} />
                <MetricaCard
                    label="Tasa escalamiento a comité"
                    value={formatPorcentaje(metricas.tasaEscalamientoComite)}
                />
                <MetricaCard
                    label="Categoría top"
                    value={
                        categoriaTop
                            ? `${formatCategoria(categoriaTop.categoria)} (${categoriaTop.total})`
                            : "—"
                    }
                />
            </div>
        </section>
    );
}

function MetricaCard({ label, value }: { label: string; value: string }) {
    return (
        <GlassCard className="p-5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-body">{value}</p>
        </GlassCard>
    );
}
