export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
    success: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    info: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
        >
            {children}
        </span>
    );
}
