"use client";

export function Sparkline({ data }: { data: { label: string; value: number }[] }) {
    if (data.length === 0) return <p className="text-sm text-slate-500">Sin datos</p>;

    const width = 500;
    const height = 160;
    const padding = 20;
    const max = Math.max(...data.map((d) => d.value), 1);
    const min = Math.min(...data.map((d) => d.value));
    const range = max - min || 1;

    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
        const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    });

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
            <polyline
                fill="none"
                stroke="#3b6bff"
                strokeWidth="2"
                points={points.join(" ")}
            />
            {data.map((d, i) => {
                const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
                const y = height - padding - ((d.value - min) / range) * (height - padding * 2);
                return (
                    <g key={i}>
                        <circle cx={x} cy={y} r="3" fill="#3b6bff" />
                        <text x={x} y={y - 10} textAnchor="middle" className="fill-slate-600 text-[9px]">
                            {d.value}
                        </text>
                        <text x={x} y={height - 4} textAnchor="middle" className="fill-slate-500 text-[9px]">
                            {d.label.slice(5)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
