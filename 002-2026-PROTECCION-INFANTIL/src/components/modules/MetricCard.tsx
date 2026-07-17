"use client";

export function MetricCard({
    label,
    value,
    suffix = "",
    sub,
    className = "",
}: {
    label: string;
    value: string | number;
    suffix?: string;
    sub?: string;
    className?: string;
}) {
    return (
        <article className={`glass rounded-2xl p-5 text-center transition hover:scale-[1.02] ${className}`}>
            <p className="text-3xl font-bold text-body">
                {value}
                {suffix && <span className="text-lg">{suffix}</span>}
            </p>
            {sub && <p className="text-xs font-semibold text-accent">{sub}</p>}
            <p className="mt-1 text-xs text-subtle">{label}</p>
        </article>
    );
}
