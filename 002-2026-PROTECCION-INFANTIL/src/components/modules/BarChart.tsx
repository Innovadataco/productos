"use client";

export function BarChart({
    data,
    ariaLabel = "Gráfico de barras",
}: {
    data: { label: string; value: number }[];
    ariaLabel?: string;
}) {
    if (data.length === 0) return <p className="text-sm text-muted">Sin datos</p>;

    const max = Math.max(...data.map((d) => d.value), 1);
    const chartHeight = 220;
    const chartWidth = 400;
    const barHeight = 24;
    const gap = 12;
    const leftMargin = 120;
    const rightMargin = 48;
    const topMargin = 16;

    return (
        <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-64"
            role="img"
            aria-label={ariaLabel}
        >
            <title>{ariaLabel}</title>
            {data.map((d, i) => {
                const y = topMargin + i * (barHeight + gap);
                const barWidth = ((d.value / max) * (chartWidth - leftMargin - rightMargin));
                return (
                    <g key={i}>
                        <text
                            x={leftMargin - 8}
                            y={y + barHeight / 2 + 4}
                            textAnchor="end"
                            className="fill-slate-600 dark:fill-slate-300 text-[10px]"
                        >
                            {d.label.length > 18 ? `${d.label.slice(0, 18)}...` : d.label}
                        </text>
                        <rect
                            x={leftMargin}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill="currentColor"
                            rx={4}
                            className="text-sky-500 dark:text-cyan-400 transition-all duration-300 hover:text-sky-600 dark:hover:text-cyan-300"
                        >
                            <title>{`${d.label}: ${d.value}`}</title>
                        </rect>
                        <text
                            x={leftMargin + barWidth + 6}
                            y={y + barHeight / 2 + 4}
                            className="fill-slate-700 dark:fill-slate-200 text-[10px] font-medium"
                        >
                            {d.value}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
