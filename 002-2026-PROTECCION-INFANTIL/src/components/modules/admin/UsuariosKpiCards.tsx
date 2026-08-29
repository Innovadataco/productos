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
                            {card.alerta && <span className="h-2 w-2 rounded-full bg-rubi" aria-hidden="true" />}
                        </div>
                        <p className="mt-1 text-3xl font-bold text-body">{card.total}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                            <span className="rounded-full bg-pino/10 px-2 py-0.5 text-pino dark:bg-pino/20">
                                {card.activos} activos
                            </span>
                            <span className="rounded-full bg-tinta/10 px-2 py-0.5 text-tinta/80 dark:bg-tinta/20 dark:text-tinta/90">
                                {card.inactivos} inactivos
                            </span>
                            {card.bloqueados > 0 && (
                                <span className="rounded-full bg-rubi/10 px-2 py-0.5 text-rubi dark:bg-rubi/20">
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
                                    ? "border-rubi/30 bg-rubi/10 text-rubi dark:border-rubi/40 dark:bg-rubi/20"
                                    : "border-ambar/30 bg-ambar/10 text-ambar dark:border-ambar/40 dark:bg-ambar/20"
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
