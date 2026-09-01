import { formatearCategoria, type PulsoData } from "@/lib/bi/pulso";

/* Paleta de segmentos con los tokens del tema; del 5.º en adelante, gris. */
const PALETA = [
    "rgb(var(--pino-rgb))",
    "rgb(var(--cielo-rgb))",
    "rgb(var(--ambar-rgb))",
    "rgb(var(--rubi-rgb))",
    "rgb(var(--tinta-subtle-rgb))",
];

function colorSegmento(i: number): string {
    return PALETA[Math.min(i, PALETA.length - 1)];
}

/**
 * Donut por categoría del mes (mockup pantalla 2): cada segmento se dibuja
 * con la animación CSS `dibujo` (offset final en el atributo, como el
 * gauge; pathLength=100 vuelve exacta la matemática). El centro muestra el
 * total REAL del mes y la leyenda repite los pct que trae la capa de datos
 * — no se recalculan aquí. Sin categorías → nota honesta, nunca un aro de
 * segmentos inventados.
 */
export default function GraficoDonut({
    categorias,
    totalMes,
}: {
    categorias: PulsoData["porCategoria"];
    totalMes: number;
}) {
    let acumulado = 0;
    const segmentos = categorias.map((c, i) => {
        const offset = 25 - acumulado; // 25 = arrancar a las 12 en punto
        acumulado += c.pct;
        return { ...c, color: colorSegmento(i), offset };
    });

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "720ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Por categoría · este mes</h3>
            <div className="mb-4 text-[13px] text-muted">Distribución del mes en curso</div>
            {segmentos.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Sin reportes clasificados en el mes todavía.
                </p>
            ) : (
                <div className="flex items-center gap-5">
                    <svg
                        width="150"
                        height="150"
                        viewBox="0 0 42 42"
                        role="img"
                        aria-label={`Distribución por categoría: ${segmentos
                            .map((s) => `${formatearCategoria(s.categoria)} ${s.pct}%`)
                            .join(", ")}`}
                        className="shrink-0"
                    >
                        <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgb(var(--tinta-rgb) / 0.07)" strokeWidth="5" />
                        {segmentos.map((s) => (
                            <circle
                                key={s.categoria}
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
                        <text x="21" y="20" textAnchor="middle" fontSize="7" fontWeight="700" fill="rgb(var(--tinta-rgb))" className="cifra">
                            {totalMes}
                        </text>
                        <text x="21" y="26" textAnchor="middle" fontSize="3.2" fill="rgb(var(--tinta-subtle-rgb))">
                            reportes
                        </text>
                    </svg>
                    <ul className="flex min-w-0 flex-1 flex-col gap-2 text-[13px]">
                        {segmentos.map((s) => (
                            <li key={s.categoria} className="flex items-center gap-2">
                                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                                <span className="truncate">{formatearCategoria(s.categoria)}</span>
                                <span className="cifra ml-auto font-semibold">{s.pct}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
