"use client";

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

interface ScoreDisplayProps {
    score: number;
    nivelRiesgo: NivelRiesgo;
    ratioAutenticados?: number;
}

const NIVEL_STYLES: Record<NivelRiesgo, { badge: string; ring: string; label: string }> = {
    BAJO: {
        badge: "bg-green-100 text-green-800",
        ring: "text-green-500",
        label: "Riesgo Bajo",
    },
    MEDIO: {
        badge: "bg-amber-100 text-amber-800",
        ring: "text-amber-500",
        label: "Riesgo Medio",
    },
    ALTO: {
        badge: "bg-orange-100 text-orange-800",
        ring: "text-orange-500",
        label: "Riesgo Alto",
    },
    CRITICO: {
        badge: "bg-red-100 text-red-800",
        ring: "text-red-600",
        label: "Riesgo Crítico",
    },
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function ScoreDisplay({ score, nivelRiesgo, ratioAutenticados }: ScoreDisplayProps) {
    const styles = NIVEL_STYLES[nivelRiesgo];
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = clamp(score, 0, 100);
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="flex items-center gap-5 rounded-2xl bg-white/60 p-5">
            <div className="relative h-24 w-24 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 84 84" aria-hidden="true">
                    <circle
                        cx="42"
                        cy="42"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-100"
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
                    <span className="text-2xl font-bold text-slate-800 font-mono">{score}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">/ 100</span>
                </div>
                <p className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 whitespace-nowrap">
                    Score de riesgo
                </p>
            </div>

            <div className="flex-1">
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${styles.badge}`}>
                    {styles.label}
                </span>
                {ratioAutenticados !== undefined && (
                    <p className="mt-2 text-xs text-slate-500">
                        {Math.round(ratioAutenticados * 100)}% de reportes autenticados
                    </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                    El score combina severidad de las conductas reportadas, recencia, autenticación y diversidad geográfica.
                </p>
            </div>
        </div>
    );
}
