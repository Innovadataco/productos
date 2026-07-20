"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatPct } from "../eval/format";
import type { SimulacionRun } from "./types";

export function SimulacionCard({ run, onClick }: { run: SimulacionRun; onClick: () => void }) {
    const metricas = (run.metricasJson || {}) as {
        accuracy?: number;
        latenciaP50Ms?: number;
    };

    const badgeVariant =
        run.estado === "COMPLETADA"
            ? "success"
            : run.estado === "FALLIDA" || run.estado === "CANCELADA"
              ? "danger"
              : run.estado === "EN_PROGRESO"
                ? "info"
                : "warning";

    return (
        <GlassCard className="p-5 cursor-pointer hover:shadow-md transition" onClick={onClick}>
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-semibold text-body">Simulación {run.id.slice(0, 8)}</h4>
                    <p className="text-xs text-muted">
                        {new Date(run.fechaInicio).toLocaleString()} · {run.totalCasos} casos
                    </p>
                </div>
                <Badge variant={badgeVariant}>{run.estado}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                    <p className="text-muted text-xs">Progreso</p>
                    <p className="font-medium">
                        {run.progreso}/{run.totalCasos}
                    </p>
                </div>
                <div>
                    <p className="text-muted text-xs">Accuracy</p>
                    <p className="font-medium">{formatPct(metricas.accuracy ?? 0)}</p>
                </div>
                <div>
                    <p className="text-muted text-xs">Latencia p50</p>
                    <p className="font-medium">{Math.round(metricas.latenciaP50Ms ?? 0)}ms</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-muted truncate">Modelo: {run.modelo}</p>
        </GlassCard>
    );
}
