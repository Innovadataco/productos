"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import type { KpiRolCard, AlertaDashboard } from "@/lib/dal/types/usuarios-consolidado";

interface UsuariosKpiCardsProps {
    kpi: KpiRolCard[];
    alertas: AlertaDashboard[];
}

export function UsuariosKpiCards({ kpi, alertas }: UsuariosKpiCardsProps) {
    return (
        <section className="space-y-4" aria-labelledby="usuarios-kpi-title">
            <div className="flex items-center justify-between gap-4">
                <h2 id="usuarios-kpi-title" className="text-lg font-semibold text-body">
                    Resumen de usuarios
                </h2>
                {alertas.length > 0 && (
                    <Badge variant="warning">{alertas.length} alerta{alertas.length > 1 ? "s" : ""}</Badge>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {kpi.map((card) => (
                    <GlassCard key={card.key} className="p-5">
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-muted">{card.label}</p>
                            {card.alerta && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
                        </div>
                        <p className="mt-1 text-3xl font-bold text-body">{card.total}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-950/50 dark:text-green-300">
                                {card.activos} activos
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {card.inactivos} inactivos
                            </span>
                            {card.bloqueados > 0 && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-950/50 dark:text-red-300">
                                    {card.bloqueados} bloqueados
                                </span>
                            )}
                        </div>
                    </GlassCard>
                ))}
            </div>
            {alertas.length > 0 && (
                <div className="space-y-2">
                    {alertas.map((alerta) => (
                        <div
                            key={alerta.tipo}
                            className={`rounded-xl border px-4 py-3 text-sm ${
                                alerta.severidad === "danger"
                                    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                            }`}
                            role="alert"
                        >
                            {alerta.mensaje}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
