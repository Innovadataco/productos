import CifraAnimada from "./CifraAnimada";

/**
 * Gauge SVG de salud operativa (0–100, mockup pantalla 2): el trazo se
 * DIBUJA con la animación CSS `dibujo` (stroke-dashoffset de 100 al valor
 * final; pathLength=100 hace la matemática exacta, sin aproximar el
 * perímetro). Gradiente pino→cielo con los tokens del tema.
 *
 * El estado final vive en el atributo stroke-dashoffset: con
 * prefers-reduced-motion el gauge aparece ya dibujado.
 * valor null → "—" y "sin datos aún" (candado 9: jamás un 0 disfrazado).
 */
export default function GaugeSalud({ valor }: { valor: number | null }) {
    const v = valor === null ? null : Math.max(0, Math.min(100, Math.round(valor)));
    return (
        <div
            className="glass anim-entrada flex items-center gap-5 px-6 py-5"
            style={{ "--anim-retardo": "180ms" } as React.CSSProperties}
        >
            <svg
                width="110"
                height="110"
                viewBox="0 0 42 42"
                role="img"
                aria-label={v === null ? "Salud operativa: sin datos" : `Salud operativa: ${v} de 100`}
            >
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgb(var(--tinta-rgb) / 0.08)" strokeWidth="4.5" />
                {v !== null && (
                    <circle
                        className="trazo-animado"
                        cx="21"
                        cy="21"
                        r="15.9"
                        fill="none"
                        stroke="url(#grad-gauge-pulso)"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray="100 100"
                        strokeDashoffset={100 - v}
                        style={{ "--dash-inicial": "100", "--dash-final": String(100 - v) } as React.CSSProperties}
                        transform="rotate(-90 21 21)"
                    />
                )}
                <defs>
                    <linearGradient id="grad-gauge-pulso" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" style={{ stopColor: "rgb(var(--pino-rgb))" }} />
                        <stop offset="100%" style={{ stopColor: "rgb(var(--cielo-rgb))" }} />
                    </linearGradient>
                </defs>
            </svg>
            <div>
                <div className="cifra text-[44px] font-bold leading-none tracking-tight">
                    {v === null ? "—" : <CifraAnimada valor={v} />}
                </div>
                <div className="microetiqueta mt-1.5">Salud operativa</div>
                {v === null && <div className="mt-1 text-[12.5px] text-subtle">sin datos aún</div>}
            </div>
        </div>
    );
}
