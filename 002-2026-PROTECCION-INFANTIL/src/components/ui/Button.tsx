import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "md" | "hero";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
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

/**
 * Escala del control (SPEC-633 · frontera de Diseño 11-09-2026). `hero` es la
 * versión grande del primario para la ÚNICA llamada de una pantalla vacía: es
 * una ESCALA del primario, no una piel a mano. `md` reproduce exactamente la
 * base anterior (px-5 text-sm) → las ~160 llamadas vigentes no cambian.
 */
const SIZE_CLASS: Record<ButtonSize, string> = {
    md: "px-5 text-sm",
    hero: "px-7 text-lg h-14",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, variant = "primary", size = "md", isLoading, className = "", ...props }, ref) => {
        const base =
            "inline-flex items-center justify-center gap-2 font-semibold active:scale-[0.98]";

        return (
            <button
                ref={ref}
                className={`${base} ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
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
