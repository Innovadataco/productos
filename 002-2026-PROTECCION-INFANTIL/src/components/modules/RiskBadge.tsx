"use client";

import { formatNivel, RIESGO_COLORS, RIESGO_TEXT_COLORS } from "@/lib/labels";

export function RiskBadge({ nivel }: { nivel: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RIESGO_TEXT_COLORS[nivel] || "text-body"}`}
            title={`Nivel de riesgo: ${formatNivel(nivel)}`}
        >
            <span className={`h-2 w-2 rounded-full ${RIESGO_COLORS[nivel] || "bg-slate-400"}`} aria-hidden="true" />
            {formatNivel(nivel)}
        </span>
    );
}
