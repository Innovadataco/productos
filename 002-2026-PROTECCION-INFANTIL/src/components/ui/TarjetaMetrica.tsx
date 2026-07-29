"use client";

/**
 * SPEC-124 (R7) — Tarjeta de métrica compartida.
 * Unifica las 4 copias locales del repo:
 * - "centrada": valor grande arriba, etiqueta abajo (modules/MetricCard).
 * - "panel": etiqueta arriba, valor abajo (AdminDashboard / AdminAntiAbusoSimulacion).
 * - `mono`: valor en font-mono 2xl centrado (ConsultaEnriquecidaClient).
 */

type TarjetaMetricaProps = {
    label: string;
    value: string | number;
    suffix?: string;
    sub?: string;
    /** "up" = rojo (sube riesgo), "down" = verde (baja riesgo). */
    tone?: "up" | "down";
    disposicion?: "centrada" | "panel";
    mono?: boolean;
    className?: string;
};

function toneClass(tone?: "up" | "down"): string {
    if (tone === "up") return "text-red-700 dark:text-red-400";
    if (tone === "down") return "text-green-700 dark:text-green-400";
    return "text-body";
}

export function TarjetaMetrica({
    label,
    value,
    suffix = "",
    sub,
    tone,
    disposicion = "centrada",
    mono = false,
    className = "",
}: TarjetaMetricaProps) {
    if (disposicion === "panel") {
        return (
            <article
                className={`glass rounded-2xl p-6 transition hover:shadow-md motion-reduce:transition-none ${className}`}
            >
                <p className="text-sm font-medium text-muted">{label}</p>
                <p className={`mt-2 text-3xl font-bold ${toneClass(tone)}`}>
                    {value}
                    {suffix && <span className="text-lg">{suffix}</span>}
                </p>
                {sub && <p className="text-xs font-semibold text-accent">{sub}</p>}
            </article>
        );
    }
    return (
        <article
            className={`glass rounded-2xl p-5 text-center transition hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 ${className}`}
        >
            <p className={`${mono ? "text-2xl font-mono" : "text-3xl"} font-bold ${toneClass(tone)}`}>
                {value}
                {suffix && <span className="text-lg">{suffix}</span>}
            </p>
            {sub && <p className="text-xs font-semibold text-accent">{sub}</p>}
            <p className="mt-1 text-xs text-subtle">{label}</p>
        </article>
    );
}
