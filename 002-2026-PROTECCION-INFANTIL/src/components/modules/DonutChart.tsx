"use client";

// SPEC-455 · mueble «la gráfica» (catálogo §4). Serie categórica en TOKENS del
// sistema —`pino`, `cielo`, `ambar` y derivados por `color-mix`— nunca color
// crudo ni rojo: `rubi` se reserva para criticidad real y nombrada, no para el
// «cuarto color de la lista». Antes era una lista de hex sueltos que incluía el
// rojo de alarma en una gráfica que solo informa. Se resuelve por variable CSS
// para que la gráfica herede el tema (claro/oscuro) sin repetir color crudo.
const SERIE = [
    "rgb(var(--pino-rgb))",
    "rgb(var(--cielo-rgb))",
    "rgb(var(--ambar-rgb))",
    "color-mix(in srgb, rgb(var(--pino-rgb)) 55%, rgb(var(--cielo-rgb)))",
    "color-mix(in srgb, rgb(var(--ambar-rgb)) 60%, rgb(var(--pino-rgb)))",
    "color-mix(in srgb, rgb(var(--cielo-rgb)) 55%, rgb(var(--ambar-rgb)))",
    "color-mix(in srgb, rgb(var(--ambar-rgb)) 45%, rgb(var(--cielo-rgb)))",
];

export function DonutChart({
    data,
    ariaLabel = "Gráfico de anillo",
}: {
    data: { label: string; value: number }[];
    ariaLabel?: string;
}) {
    if (data.length === 0) return <p className="text-sm text-muted">Sin datos</p>;

    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
            <svg
                viewBox="0 0 180 180"
                className="h-40 w-40 flex-shrink-0"
                role="img"
                aria-label={ariaLabel}
            >
                <title>{ariaLabel}</title>
                <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeWidth="20" className="text-tinta/10 dark:text-white/10" />
                {data.map((d, i) => {
                    const previous = data.slice(0, i).reduce((sum, item) => sum + item.value, 0);
                    const segment = (d.value / total) * circumference;
                    const offset = circumference - (previous / total) * circumference;
                    const percentage = Math.round((d.value / total) * 100);
                    return (
                        <circle
                            key={i}
                            cx="90"
                            cy="90"
                            r={radius}
                            fill="none"
                            stroke={SERIE[i % SERIE.length]}
                            strokeWidth="20"
                            strokeDasharray={`${segment} ${circumference - segment}`}
                            strokeDashoffset={offset}
                            transform="rotate(-90 90 90)"
                            className="transition-all duration-300 hover:opacity-80"
                        >
                            <title>{`${d.label}: ${d.value} (${percentage}%)`}</title>
                        </circle>
                    );
                })}
                <text x="90" y="95" textAnchor="middle" className="fill-current text-body text-base font-bold">
                    {total}
                </text>
            </svg>
            <ul className="flex flex-col gap-1.5 text-xs" aria-label="Leyenda del gráfico">
                {data.map((d, i) => {
                    const percentage = Math.round((d.value / total) * 100);
                    return (
                        <li key={i} className="flex items-center gap-2">
                            <span
                                className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: SERIE[i % SERIE.length] }}
                            />
                            {/* Etiqueta en versalita (catálogo §4): la categoría en small-caps,
                                el número en cifra normal. */}
                            <span className="text-body">
                                <span className="[font-variant:small-caps]">{d.label}</span>: <span className="font-medium">{d.value}</span> ({percentage}%)
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
