"use client";

const COLORS = ["#3b6bff", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#64748b"];

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
                <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeWidth="20" className="text-slate-200 dark:text-slate-700" />
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
                            stroke={COLORS[i % COLORS.length]}
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
                <text x="90" y="95" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-base font-bold">
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
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="text-slate-700 dark:text-slate-300">
                                {d.label}: <span className="font-medium">{d.value}</span> ({percentage}%)
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
