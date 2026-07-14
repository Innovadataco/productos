"use client";

export function Sparkline({
    data,
    ariaLabel = "Gráfico de tendencia",
}: {
    data: { label: string; value: number }[];
    ariaLabel?: string;
}) {
    if (data.length === 0) return <p className="text-sm text-slate-500">Sin datos</p>;

    const width = 500;
    const height = 180;
    const padding = { top: 24, right: 24, bottom: 32, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const max = Math.max(...data.map((d) => d.value), 1);
    const min = Math.min(...data.map((d) => d.value));
    const range = max - min || 1;

    const getX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const getY = (value: number) => padding.top + chartHeight - ((value - min) / range) * chartHeight;

    const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(" ");
    const areaPoints = `${points} ${getX(data.length - 1)},${padding.top + chartHeight} ${getX(0)},${padding.top + chartHeight}`;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-52"
            role="img"
            aria-label={ariaLabel}
        >
            <title>{ariaLabel}</title>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = padding.top + chartHeight - ratio * chartHeight;
                return (
                    <line
                        key={i}
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                );
            })}
            {/* Y-axis labels */}
            {[0, 0.5, 1].map((ratio, i) => {
                const value = Math.round(min + ratio * range);
                const y = padding.top + chartHeight - ratio * chartHeight;
                return (
                    <text key={i} x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                        {value}
                    </text>
                );
            })}
            {/* Area under line */}
            <polygon points={areaPoints} fill="#3b6bff" fillOpacity="0.1" />
            {/* Line */}
            <polyline
                fill="none"
                stroke="#3b6bff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            {/* Data points */}
            {data.map((d, i) => {
                const x = getX(i);
                const y = getY(d.value);
                return (
                    <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#3b6bff" stroke="white" strokeWidth="2" className="hover:r-5 transition-all">
                            <title>{`${d.label}: ${d.value}`}</title>
                        </circle>
                        <text x={x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[9px]">
                            {d.label.slice(5)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
