import { type KeyboardEvent } from "react";

/** Activación por clic o por teclado (Enter/Espacio): mismo handler, evento sintético base compartido. */
type EventoActivacion = React.MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>;

interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
    children: React.ReactNode;
    className?: string;
    onClick?: (evento: EventoActivacion) => void;
}

export function GlassCard({ children, className = "", onClick, onKeyDown, tabIndex, role, ...props }: GlassCardProps) {
    const isInteractive = typeof onClick === "function";

    function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick?.(e);
        }
        onKeyDown?.(e);
    }

    if (isInteractive) {
        return (
            <div
                className={`glass rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}
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
        <div className={`glass rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`} {...props}>
            {children}
        </div>
    );
}
