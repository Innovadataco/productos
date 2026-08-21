"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCategoria } from "../utils";
import type { CategoriaConteo } from "../types";

export function DistribucionCategorias({ casosPorCategoria }: { casosPorCategoria: CategoriaConteo[] }) {
    const maxTotal = useMemo(() => {
        const valores = casosPorCategoria.map((c) => c.total);
        return valores.length > 0 ? Math.max(...valores) : 0;
    }, [casosPorCategoria]);

    return (
        <section className="space-y-4" aria-labelledby="distribucion-title">
            <h2 id="distribucion-title" className="text-lg font-semibold text-body">
                Distribución por categoría
            </h2>
            <GlassCard>
                {casosPorCategoria.length === 0 ? (
                    <EmptyState
                        title="Sin datos de categorías"
                        description="No hay casos resueltos en los últimos 30 días para calcular la distribución."
                    />
                ) : (
                    <div className="space-y-3">
                        {[...casosPorCategoria].sort((a, b) => b.total - a.total).map((c) => {
                            const ancho = maxTotal > 0 ? Math.round((c.total / maxTotal) * 100) : 0;
                            return (
                                <div key={c.categoria} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-body">{formatCategoria(c.categoria)}</span>
                                        <span className="text-muted">{c.total}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${ancho}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>
        </section>
    );
}
