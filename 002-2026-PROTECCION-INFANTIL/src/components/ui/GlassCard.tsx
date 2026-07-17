export function GlassCard({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`glass rounded-3xl p-6 sm:p-8 ${className}`} {...props}>
            {children}
        </div>
    );
}
