"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ColorSemaforo } from "@/lib/padre/semaforo";

interface SemaforoItemProps {
    etiqueta: string | null;
    color: ColorSemaforo;
    totalReportes: number;
    categoriaDominante: string | null;
    activo: boolean;
}

const CONFIG: Record<ColorSemaforo, { label: string; clase: string; anillo: string }> = {
    VERDE: {
        label: "Sin novedades",
        clase: "bg-pino text-white",
        anillo: "ring-pino/30",
    },
    AMBAR: {
        label: "Requiere atención",
        clase: "bg-ambar text-white",
        anillo: "ring-ambar/30",
    },
    ROJO: {
        label: "Alerta prioritaria",
        clase: "bg-rubi text-white",
        anillo: "ring-rubi/30",
    },
};

export function SemaforoItem({ etiqueta, color, totalReportes, categoriaDominante, activo }: SemaforoItemProps) {
    const config = CONFIG[color];
    const nombre = etiqueta ?? "Sin nombre";

    return (
        <Link
            href="/dashboard/padre/circulo-confianza"
            className={`block ${!activo ? "opacity-60" : ""}`}
            aria-label={`${nombre}: ${config.label}`}
        >
            <GlassCard className="p-4 transition hover:shadow-lg">
                <div className="flex items-center gap-4">
                    <span
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ${config.clase} ${config.anillo}`}
                        aria-hidden="true"
                    >
                        {color === "VERDE" ? "V" : color === "AMBAR" ? "A" : "R"}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-body">{nombre}</h3>
                        <p className="text-xs text-muted">
                            {totalReportes === 0
                                ? "Sin reportes registrados"
                                : `${totalReportes} ${totalReportes === 1 ? "reporte" : "reportes"} registrados`}
                        </p>
                        {categoriaDominante && (
                            <p className="mt-1 truncate text-xs text-subtle">Categoría: {categoriaDominante}</p>
                        )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.clase}`}>{config.label}</span>
                </div>
            </GlassCard>
        </Link>
    );
}
