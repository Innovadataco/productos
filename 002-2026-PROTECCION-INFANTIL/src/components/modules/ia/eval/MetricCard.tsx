"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { formatPct } from "./format";

interface MetricCardProps {
    label: string;
    value: number;
    baseline?: number;
    invert?: boolean;
    formato?: "pct" | "numero";
}

export function MetricCard({ label, value, baseline, invert, formato = "pct" }: MetricCardProps) {
    const d = baseline !== undefined ? value - baseline : 0;
    const sign = d > 0 ? "+" : "";
    const good = invert ? d < 0 : d > 0;
    const bad = invert ? d > 0 : d < 0;
    const mostrar = formato === "numero" ? String(Math.round(value)) : formatPct(value);
    return (
        <GlassCard className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-semibold text-body">{mostrar}</p>
            {baseline !== undefined && (
                <p className={`text-xs ${good ? "text-green-600 dark:text-green-400" : bad ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                    {sign}{formatPct(d)} vs base
                </p>
            )}
        </GlassCard>
    );
}
