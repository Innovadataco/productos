import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
};

const STYLES: Record<ButtonVariant, string> = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
    outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = "primary", className = "", ...props }, ref) => {
        const base =
            "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
        return (
            <button ref={ref} className={`${base} ${STYLES[variant]} ${className}`.trim()} {...props}>
                {children}
            </button>
        );
    },
);
Button.displayName = "Button";
