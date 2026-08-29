import type { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
}

export function Card({ children, className = "" }: CardProps) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`.trim()}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = "" }: CardProps) {
    return (
        <h3 className={`text-base font-semibold text-slate-900 ${className}`.trim()}>{children}</h3>
    );
}
