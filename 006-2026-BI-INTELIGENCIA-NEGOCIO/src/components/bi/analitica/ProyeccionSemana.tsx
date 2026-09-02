import type { AnaliticaData } from "@/lib/bi/analitica";
import { fmtMiles } from "@/components/bi/pulso/formatos";

/* Geometría fija del SVG (viewBox 560×220, como el mockup v4): el histórico
   ocupa x 48→392 y el futuro 448→504; la banda de rango se abre desde el
   último punto real hasta el min/max proyectado de la próxima semana. */
const X0 = 48;
const X1 = 392;
const X_FIN = 504;
const Y_BASE = 190;
const Y_TOPE = 30;

/**
 * Proyección de la próxima semana (mockup v4, sección 2): tendencia de las
 * últimas semanas con el trazo dibujándose (`trazo-animado`), futuro en línea
 * punteada con banda de rango sombreada. Predictiva honesta: se comunica un
 * RANGO ("min–max reportes · rango, no promesa"), jamás una cifra puntual.
 * Candado 9: sin base (`hayBase` falso o serie corta) se anuncia "sin
 * proyección aún" en vez de dibujar un eje vacío. Candado 10: los totales y
 * el rango son los del contrato; aquí solo se posicionan en el SVG.
 */
export default function ProyeccionSemana({
    proyeccion,
}: {
    proyeccion: AnaliticaData["proyeccion"];
}) {
    const { semanaProximaMin, semanaProximaMax, tendenciaSemanas, hayBase } = proyeccion;
    const hayGrafico =
        hayBase && tendenciaSemanas.length >= 2 && semanaProximaMin !== null && semanaProximaMax !== null;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "120ms" } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[17px] font-semibold">Proyección de la próxima semana</h3>
            <div className="mb-4 text-[13px] text-muted">
                Tendencia de las últimas {tendenciaSemanas.length} semanas + rango de confianza — la línea
                punteada es futuro
            </div>
            {!hayGrafico ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Sin proyección aún: la réplica todavía no tiene suficientes semanas para proyectar con
                    honestidad.
                </p>
            ) : (
                <ProyeccionSvg
                    tendencia={tendenciaSemanas}
                    min={semanaProximaMin}
                    max={semanaProximaMax}
                />
            )}
            {hayGrafico && (
                <div className="mt-3 text-[12px] text-muted">
                    Si sigue el ritmo:{" "}
                    <b className="cifra text-body">
                        {fmtMiles(semanaProximaMin)}–{fmtMiles(semanaProximaMax)} reportes
                    </b>{" "}
                    la próxima semana (rango, no promesa).
                </div>
            )}
        </div>
    );
}

function ProyeccionSvg({
    tendencia,
    min,
    max,
}: {
    tendencia: AnaliticaData["proyeccion"]["tendenciaSemanas"];
    min: number;
    max: number;
}) {
    const maxV = Math.max(...tendencia.map((s) => s.total), max, 1);
    const y = (v: number) => Y_BASE - (v / maxV) * (Y_BASE - Y_TOPE);
    const n = tendencia.length;
    const x = (i: number) => X0 + ((X1 - X0) * i) / (n - 1);

    const puntos = tendencia.map((s, i) => `${x(i).toFixed(1)},${y(s.total).toFixed(1)}`).join(" ");
    const ultimo = { x: X1, y: y(tendencia[n - 1].total) };
    // La línea punteada cae en el centro visual de la banda (solo posición; no es una cifra impresa).
    const yFuturo = y((min + max) / 2);
    const banda = `M ${ultimo.x} ${ultimo.y.toFixed(1)} L ${X_FIN} ${y(max).toFixed(1)} L ${X_FIN} ${y(min).toFixed(1)} Z`;

    return (
        <svg width="100%" height="220" viewBox="0 0 560 220" preserveAspectRatio="none" role="img"
            aria-label={`Tendencia semanal de reportes y proyección de la próxima semana entre ${min} y ${max}`}>
            <defs>
                <linearGradient id="grad-linea-proy" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(var(--cielo-rgb))" />
                    <stop offset="100%" stopColor="rgb(var(--pino-rgb))" />
                </linearGradient>
            </defs>
            {/* banda de rango del futuro */}
            <path d={banda} fill="rgb(var(--cielo-rgb) / 0.15)" />
            {/* histórico: trazo que se dibuja (prefers-reduced-motion lo muestra ya final) */}
            <polyline
                points={puntos}
                fill="none"
                stroke="url(#grad-linea-proy)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="800"
                className="trazo-animado"
                style={{ "--dash-inicial": 800, "--dash-final": 0 } as React.CSSProperties}
            />
            {/* proyección punteada */}
            <polyline
                points={`${ultimo.x},${ultimo.y.toFixed(1)} ${X_FIN},${yFuturo.toFixed(1)}`}
                fill="none"
                stroke="rgb(var(--cielo-rgb))"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
            />
            <circle cx={X_FIN} cy={yFuturo} r="5" fill="rgb(var(--cielo-rgb))" className="anim-pulso" />
            <text x={X_FIN} y="210" textAnchor="middle" fontSize="10.5" fill="rgb(var(--tinta-subtle-rgb))">
                próxima semana
            </text>
        </svg>
    );
}
