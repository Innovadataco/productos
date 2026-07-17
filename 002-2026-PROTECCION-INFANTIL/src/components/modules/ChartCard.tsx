"use client";

export function ChartCard({
    title,
    subtitle,
    children,
    className = "",
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <article className={`glass rounded-2xl p-5 transition hover:scale-[1.01] ${className}`}>
            <h2 className="text-base font-semibold text-body">{title}</h2>
            {subtitle && <p className="mb-3 text-xs text-subtle">{subtitle}</p>}
            {children}
        </article>
    );
}
