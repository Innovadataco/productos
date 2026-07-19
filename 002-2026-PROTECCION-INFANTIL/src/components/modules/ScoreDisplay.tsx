"use client";

import { useState } from "react";

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export interface ScoreDisplayProps {
    score: number;
    nivelRiesgo: NivelRiesgo;
    ratioAutenticados?: number;
    totalReportes?: number;
    ciudades?: string[];
    categoriaPrincipal?: string;
}

const RECOMENDACIONES: Record<NivelRiesgo, string> = {
    BAJO: "Sin riesgo significativo. Precaución habitual.",
    MEDIO: "Mantén precaución y conversa sobre contactos desconocidos.",
    ALTO: "Habla con tu hijo/a y verifica conversaciones.",
    CRITICO: "Bloquea y habla con tu hijo/a. Considera denunciar.",
};

const NIVEL_STYLES: Record<NivelRiesgo, { badge: string; ring: string; label: string }> = {
    BAJO: {
        badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
        ring: "text-emerald-500 dark:text-emerald-400",
        label: "RIESGO BAJO",
    },
    MEDIO: {
        badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
        ring: "text-amber-500 dark:text-amber-400",
        label: "RIESGO MEDIO",
    },
    ALTO: {
        badge: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
        ring: "text-orange-500 dark:text-orange-400",
        label: "RIESGO ALTO",
    },
    CRITICO: {
        badge: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
        ring: "text-red-500 dark:text-red-400",
        label: "RIESGO CRÍTICO",
    },
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function ScoreDisplay({
    score,
    nivelRiesgo,
    ratioAutenticados,
    totalReportes,
    ciudades,
    categoriaPrincipal,
}: ScoreDisplayProps) {
    const styles = NIVEL_STYLES[nivelRiesgo];
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = clamp(score, 0, 100);
    const offset = circumference - (progress / 100) * circumference;
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="rounded-2xl bg-white/40 dark:bg-slate-900/40 p-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div className="relative h-28 w-28 shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 84 84" aria-hidden="true">
                        <circle
                            cx="42"
                            cy="42"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-slate-100 dark:text-slate-800"
                        />
                        <circle
                            cx="42"
                            cy="42"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            className={styles.ring}
                            style={{
                                strokeDasharray: circumference,
                                strokeDashoffset: offset,
                                transition: "stroke-dashoffset 500ms ease-out",
                            }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-body font-mono">{score}</span>
                        <span className="text-[10px] uppercase tracking-wide text-subtle">/ 100</span>
                    </div>
                    <p className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-subtle whitespace-nowrap">
                        Score de riesgo
                    </p>
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <span
                        className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${styles.badge}`}
                        data-testid="score-nivel"
                    >
                        {styles.label}
                    </span>
                    <p className="mt-3 text-sm font-medium text-body" data-testid="score-recomendacion">
                        {RECOMENDACIONES[nivelRiesgo]}
                    </p>
                    {ratioAutenticados !== undefined && (
                        <p className="mt-2 text-xs text-muted">
                            {Math.round(ratioAutenticados * 100)}% de reportes autenticados
                        </p>
                    )}
                    <p className="mt-2 text-xs text-subtle">
                        El score combina severidad de las conductas reportadas, recencia, autenticación y diversidad geográfica.
                    </p>
                </div>
            </div>

            {(totalReportes !== undefined || ciudades?.length || categoriaPrincipal) && (
                <div className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-4">
                    <button
                        onClick={() => setShowDetails((v) => !v)}
                        className="text-sm font-medium text-accent hover:underline underline-offset-2"
                        aria-expanded={showDetails}
                        data-testid="score-ver-detalles"
                    >
                        {showDetails ? "Ocultar detalles" : "Ver detalles"}
                    </button>

                    {showDetails && (
                        <div className="mt-3 space-y-2 text-sm text-body animate-floatUp">
                            {totalReportes !== undefined && (
                                <p>
                                    <span className="font-medium">Total de reportes:</span> {totalReportes}
                                </p>
                            )}
                            {categoriaPrincipal && (
                                <p>
                                    <span className="font-medium">Categoría principal:</span> {categoriaPrincipal}
                                </p>
                            )}
                            {ciudades && ciudades.length > 0 && (
                                <p>
                                    <span className="font-medium">Ciudades con reportes:</span>{" "}
                                    {ciudades.slice(0, 10).join(", ")}
                                    {ciudades.length > 10 && ` y ${ciudades.length - 10} más`}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
