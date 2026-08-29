import { GlassCard } from "@/components/ui/GlassCard";

type EmptyStateProps = {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
};

export function EmptyState({
    title,
    description,
    icon,
    action,
    className = "",
}: EmptyStateProps) {
    return (
        <GlassCard
            className={`text-center ${className}`}
            role="status"
            aria-live="polite"
        >
            {icon ?? (
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
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
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                        />
                    </svg>
                </div>
            )}
            <h3 className="mt-4 text-base font-semibold text-body">{title}</h3>
            {description && <p className="mt-2 text-sm text-muted">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </GlassCard>
    );
}

