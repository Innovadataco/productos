import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    isLoading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = "primary", isLoading, className = "", ...props }, ref) => {
        const base =
            "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ring-accent";

        const styles: Record<ButtonVariant, string> = {
            primary:
                "accent-gradient text-white shadow-lg shadow-sky-500/25 dark:shadow-sky-400/20 hover:brightness-110",
            secondary:
                "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600",
            outline:
                "glass-input text-body hover:bg-white/80 dark:hover:bg-slate-800/80 border",
            ghost: "text-muted hover:text-body hover:bg-slate-100 dark:hover:bg-slate-800/60",
            danger: "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600",
        };

        return (
            <button ref={ref} className={`${base} ${styles[variant]} ${className}`} disabled={isLoading || props.disabled} {...props}>
                {isLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                    children
                )}
            </button>
        );
    }
);

Button.displayName = "Button";
