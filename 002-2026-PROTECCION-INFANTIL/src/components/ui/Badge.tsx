export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

// SPEC-457 · Badge al Sistema de Diseño (catálogo §2). Pastilla de estado por
// FUNCIÓN semántica, en tokens: nunca color crudo, nunca rojo decorativo.
//   success → pino (ok/verificado) · warning → ambar (atención)
//   danger  → rubi (criticidad REAL) · neutral → neutro (tinta velada)
//   default/info → cielo (informativo/marca)
// Los tokens voltean solos en modo oscuro (variables CSS), así que no hace falta
// la variante `dark:`. La conducta no cambia: cada variante muestra el MISMO
// estado que antes, y el estado se lee por texto (children) además del color.
const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-cielo/10 text-cielo",
    success: "bg-pino/10 text-pino",
    warning: "bg-ambar/10 text-ambar",
    danger: "bg-rubi/10 text-rubi",
    info: "bg-cielo/10 text-cielo",
    neutral: "bg-tinta/10 text-muted",
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
