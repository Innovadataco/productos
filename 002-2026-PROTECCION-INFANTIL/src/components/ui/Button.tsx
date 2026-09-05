import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    isLoading?: boolean;
};

/**
 * SPEC-454 (OLA 1 del rediseño) · Button al Sistema de Diseño v1.3.
 *
 * La API NO cambia (5 variantes en uso en ~160 archivos; colapsar a 3 sería
 * rework fuera de alcance — decisión CEO). Cambia la PIEL: color por token
 * (cero crudo), radio 16px, y la firma (gradiente + grano + órbita) SOLO en el
 * primario. Las tres jerarquías del §7.1 mapean así (decisión de Diseño):
 *   primary            → Primario  (sólido con firma; el único sólido)
 *   secondary, outline → Fantasma  (transparente + borde del acento)
 *   ghost              → Sutil     (velo)
 *   danger             → Fantasma-rubí (borde rubí; el sólido rubí se reserva
 *                        al «confirmar» del modal, no se reparte por 16 pantallas)
 *
 * El color del acento se lee de `--accent` (fallback pino) — SPEC-460 lo
 * declara por rol en los layouts; hasta entonces sale en pino, estado
 * intermedio honesto. Toda la piel vive en `globals.css` (.btn-ds*), incluido
 * el apagado de la órbita bajo `prefers-reduced-motion` / `hover: none` (§5).
 *
 * Conducta intacta (candado `Button.test.tsx`): onClick, disabled, isLoading,
 * forwardRef, props HTML, foco por teclado.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
    primary: "btn-ds btn-ds--primary",
    secondary: "btn-ds btn-ds--fantasma",
    outline: "btn-ds btn-ds--fantasma",
    ghost: "btn-ds btn-ds--sutil",
    danger: "btn-ds btn-ds--fantasma-rubi",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = "primary", isLoading, className = "", ...props }, ref) => {
        const base =
            "inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold active:scale-[0.98]";

        return (
            <button
                ref={ref}
                className={`${base} ${VARIANT_CLASS[variant]} ${className}`}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading ? (
                    <span
                        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden="true"
                    />
                ) : (
                    children
                )}
            </button>
        );
    }
);

Button.displayName = "Button";
