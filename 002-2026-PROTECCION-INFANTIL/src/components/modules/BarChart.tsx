"use client";

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
    if (data.length === 0) return <p className="text-sm text-slate-500">Sin datos</p>;

    const max = Math.max(...data.map((d) => d.value), 1);

    return (
        <svg viewBox="0 0 400 240" className="w-full h-60">
            {data.map((d, i) => {
                const barHeight = (d.value / max) * 160;
                const y = 180 - barHeight;
                const x = 20 + i * (360 / data.length);
                const width = 360 / data.length - 10;
                return (
                    <g key={i}>
                        <rect
                            x={x}
                            y={y}
                            width={width}
                            height={barHeight}
                            fill="#3b6bff"
                            rx={4}
                        />
                        <text
                            x={x + width / 2}
                            y={y - 8}
                            textAnchor="middle"
                            className="fill-slate-700 text-[10px]"
                        >
                            {d.value}
                        </text>
                        <text
                            x={x + width / 2}
                            y={200}
                            textAnchor="middle"
                            className="fill-slate-500 text-[9px]"
                        >
                            {d.label.length > 12 ? `${d.label.slice(0, 12)}...` : d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
