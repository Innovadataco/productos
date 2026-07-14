"use client";

const COLORS = ["#3b6bff", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#64748b"];

export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
    if (data.length === 0) return <p className="text-sm text-slate-500">Sin datos</p>;

    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    let accumulated = 0;

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 200 200" className="h-48 w-48">
                <circle cx="100" cy="100" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="24" />
                {data.map((d, i) => {
                    const segment = (d.value / total) * circumference;
                    const offset = circumference - accumulated;
                    accumulated += segment;
                    return (
                        <circle
                            key={i}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth="24"
                            strokeDasharray={`${segment} ${circumference - segment}`}
                            strokeDashoffset={offset}
                            transform="rotate(-90 100 100)"
                        />
                    );
                })}
                <text x="100" y="105" textAnchor="middle" className="fill-slate-800 text-lg font-bold">
                    {total}
                </text>
            </svg>
            <ul className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                {data.map((d, i) => (
                    <li key={i} className="flex items-center gap-1">
                        <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {d.label}: {d.value}
                    </li>
                ))}
            </ul>
        </div>
    );
}
