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
    suffix?: string | undefined;
    sub?: string | undefined;
    /** SPEC-537: "up" = ámbar (sube riesgo), "down" = pino (baja riesgo). Nunca rubí. */
    tone?: "up" | "down" | undefined;
    disposicion?: "centrada" | "panel" | undefined;
    mono?: boolean | undefined;
    className?: string | undefined;
};

// SPEC-537 (data-viz por DIRECCIÓN): sube-riesgo → ámbar, baja-riesgo → pino. NUNCA rubí:
// una flecha de tendencia no es una alarma (el rubí se reserva a criticidad real). Exportada
// como fuente única del mapeo dirección→token para el candado.
export function toneClass(tone?: "up" | "down"): string {
    if (tone === "up") return "text-estado-ambar";
    if (tone === "down") return "text-estado-pino";
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
