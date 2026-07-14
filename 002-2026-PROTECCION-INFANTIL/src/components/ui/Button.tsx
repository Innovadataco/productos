export function Button({
    children,
    variant = "primary",
    isLoading,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline"; isLoading?: boolean }) {
    const base = "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const styles = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-400 shadow-md",
        secondary: "bg-accent-600 text-white hover:bg-accent-700 focus:ring-accent-400 shadow-md",
        outline: "border-2 border-slate-200 bg-white/60 text-slate-700 hover:border-primary-300 hover:bg-primary-50 focus:ring-primary-200",
    };
    return (
        <button className={`${base} ${styles[variant]}`} disabled={isLoading || props.disabled} {...props}>
            {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
                children
            )}
        </button>
    );
}