import type { PersonasData } from "@/lib/bi/personas";
import { fmtMiles } from "../pulso/formatos";

/* Paleta de segmentos con los tokens del tema (misma convención que el
   donut del Pulso); del 4.º sujeto en adelante, gris. */
const PALETA = [
    "rgb(var(--pino-rgb))",
    "rgb(var(--ambar-rgb))",
    "rgb(var(--rubi-rgb))",
    "rgb(var(--cielo-rgb))",
    "rgb(var(--tinta-subtle-rgb))",
];

/** Tipo de sujeto de la alerta → etiqueta legible en plural. */
const ETIQUETAS_SUJETO: Record<string, string> = {
    ALUMNO: "Alumnos",
    ACUDIENTE: "Acudientes",
    PROFESOR: "Profesores",
};

function etiquetaSujeto(sujeto: string): string {
    const clave = sujeto.toUpperCase().replace(/\s+/g, "_");
    if (ETIQUETAS_SUJETO[clave]) return ETIQUETAS_SUJETO[clave];
    const limpia = sujeto.replace(/_/g, " ").toLowerCase();
    return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/**
 * Donut de alertas por tipo de sujeto (mockup v3 pantalla 2): cada segmento
 * se dibuja con la animación CSS `dibujo` (pathLength=100, misma técnica que
 * GraficoDonut del Pulso). El centro muestra el total REAL (suma de las
 * filas del ResultSet) y la leyenda los pct derivados de ese mismo total.
 * Sin alertas → nota honesta, nunca un aro inventado (candado 9).
 */
export default function DonutAlertasSujeto({
    alertasPorSujeto,
    retardo = 320,
}: {
    alertasPorSujeto: PersonasData["alertasPorSujeto"];
    retardo?: number;
}) {
    const total = alertasPorSujeto.reduce((acc, a) => acc + a.total, 0);
    let acumulado = 0;
    const segmentos = alertasPorSujeto.map((a, i) => {
        const pct = total > 0 ? Math.round((a.total / total) * 100) : 0;
        const offset = 25 - acumulado; // 25 = arrancar a las 12 en punto
        acumulado += pct;
        return { ...a, etiqueta: etiquetaSujeto(a.sujeto), pct, offset, color: PALETA[Math.min(i, PALETA.length - 1)] };
    });

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Alertas por tipo de sujeto</h3>
            <div className="mb-4 text-[13px] text-muted">Alertas de colegio del histórico replicado</div>
            {segmentos.length === 0 || total === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay alertas de colegio en la réplica.
                </p>
            ) : (
                <div className="flex items-center gap-5">
                    <svg
                        width="150"
                        height="150"
                        viewBox="0 0 42 42"
                        role="img"
                        aria-label={`Alertas por sujeto: ${segmentos.map((s) => `${s.etiqueta} ${s.pct}%`).join(", ")}`}
                        className="shrink-0"
                    >
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgb(var(--tinta-rgb) / 0.07)" strokeWidth="5" />
                        {segmentos.map((s) => (
                            <circle
                                key={s.sujeto}
                                className="trazo-animado"
                                cx="21"
                                cy="21"
                                r="15.9"
                                fill="none"
                                stroke={s.color}
                                strokeWidth="5"
                                pathLength={100}
                                strokeDasharray={`${s.pct} ${100 - s.pct}`}
                                strokeDashoffset={s.offset}
                                style={
                                    {
                                        "--dash-inicial": String(s.offset + 100),
                                        "--dash-final": String(s.offset),
                                    } as React.CSSProperties
                                }
                            />
                        ))}
                        <text x="21" y="20" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="rgb(var(--tinta-rgb))" className="cifra">
                            {fmtMiles(total)}
                        </text>
                        <text x="21" y="26" textAnchor="middle" fontSize="3.2" fill="rgb(var(--tinta-subtle-rgb))">
                            alertas
                        </text>
                    </svg>
                    <ul className="flex min-w-0 flex-1 flex-col gap-2 text-[13px]">
                        {segmentos.map((s) => (
                            <li key={s.sujeto} className="flex items-center gap-2">
                                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                                <span className="truncate">{s.etiqueta}</span>
                                <span className="cifra ml-auto font-semibold">{s.pct}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
