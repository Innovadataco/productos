"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { formatPct } from "./format";
import type { Experimento } from "./types";

export function ExperimentCard({ exp, onClick }: { exp: Experimento; onClick: () => void }) {
    const metrics = (exp.resultadoJson?.metrics || {}) as {
        errorSilencioso?: number;
        revisionManualRate?: number;
        accuracy?: number;
    };
    const config = exp.configSnapshot || {};
    return (
        <GlassCard className="p-5 cursor-pointer hover:shadow-md transition" onClick={onClick}>
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-semibold text-body">{exp.nombre || `Experimento ${exp.id.slice(0, 8)}`}</h4>
                    <p className="text-xs text-muted">
                        {new Date(exp.iniciadoEn).toLocaleString()} · fixture v{exp.fixtureVersion}
                    </p>
                </div>
                <Badge variant={exp.estado === "COMPLETADA" ? "success" : exp.estado === "FALLIDA" ? "danger" : "warning"}>
                    {exp.estado}
                </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                    <p className="text-muted text-xs">Error silencioso</p>
                    <p className="font-medium">{formatPct(metrics.errorSilencioso ?? 0)}</p>
                </div>
                <div>
                    <p className="text-muted text-xs">Revisión manual</p>
                    <p className="font-medium">{formatPct(metrics.revisionManualRate ?? 0)}</p>
                </div>
                <div>
                    <p className="text-muted text-xs">Accuracy</p>
                    <p className="font-medium">{formatPct(metrics.accuracy ?? 0)}</p>
                </div>
            </div>
            <p className="mt-3 text-xs text-muted truncate">Modelo: {String(config.modeloClasificacion || "—")}</p>
        </GlassCard>
    );
}
