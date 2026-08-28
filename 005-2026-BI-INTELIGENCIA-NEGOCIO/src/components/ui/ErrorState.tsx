import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

type ErrorStateProps = {
    title?: string;
    description?: string;
    onRetry?: () => void;
    retryLabel?: string;
    action?: React.ReactNode;
    className?: string;
};

export function ErrorState({
    title = "No pudimos cargar la información",
    description = "Ocurrió un error inesperado. Puedes intentarlo de nuevo o volver más tarde.",
    onRetry,
    retryLabel = "Reintentar",
    action,
    className = "",
}: ErrorStateProps) {
    return (
        <GlassCard
            className={`text-center ${className}`}
            role="alert"
            aria-live="polite"
        >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-body">{title}</h3>
            <p className="mt-2 text-sm text-muted">{description}</p>
            {(onRetry || action) && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    {onRetry && (
                        <Button variant="outline" onClick={onRetry}>
                            {retryLabel}
                        </Button>
                    )}
                    {action}
                </div>
            )}
        </GlassCard>
    );
}

