import { type KeyboardEvent } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export function GlassCard({ children, className = "", onClick, onKeyDown, tabIndex, role, ...props }: GlassCardProps) {
    const isInteractive = typeof onClick === "function";

    function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
        onKeyDown?.(e);
    }

    if (isInteractive) {
        return (
            <div
                className={`glass rounded-3xl p-6 sm:p-8 ${className}`}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                tabIndex={tabIndex ?? 0}
                role={role ?? "button"}
                {...props}
            >
                {children}
            </div>
        );
    }

    return (
        <div className={`glass rounded-3xl p-6 sm:p-8 ${className}`} {...props}>
            {children}
        </div>
    );
}
