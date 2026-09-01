/**
 * Sparkline SVG del KPI: dibuja TAL CUAL la serie real que recibe
 * (normaliza solo la escala, jamás genera ni interpola puntos).
 * Sin serie → no se renderiza (candado 9: antes vacío que inventado).
 */
export default function Sparkline({ puntos }: { puntos: number[] }) {
    if (puntos.length === 0) return null;

    const ANCHO = 120;
    const ALTO = 34;
    const max = Math.max(...puntos, 1);
    const pasoX = puntos.length > 1 ? ANCHO / (puntos.length - 1) : 0;
    const coords = puntos.map((v, i) => ({
        x: puntos.length > 1 ? i * pasoX : ANCHO / 2,
        y: 30 - (v / max) * 26,
    }));

    return (
        <svg
            width="100%"
            height={ALTO}
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="mt-2.5"
        >
            {coords.length === 1 ? (
                <circle cx={coords[0].x} cy={coords[0].y} r="2.5" fill="rgb(var(--pino-rgb))" />
            ) : (
                <polyline
                    points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke="rgb(var(--pino-rgb))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            )}
        </svg>
    );
}
