import type { ReactNode } from "react";

/**
 * SPEC-124 (R7) — Alerta inline compartida.
 * SPEC-458 (OLA 1 · sistema de diseño §3) — color POR FUNCIÓN en tokens:
 *   éxito → `pino`, atención → `ambar`, error → `rubi` (nunca rojo puro),
 *   info → `cielo`. Fondo con alpha del token (`bg-{token}/10`) y texto con la
 *   variante de estado AA (`.text-estado-{token}`). Icono a la izquierda; el
 *   mensaje (children) debe decir **qué pasó + qué hacer**. Sin cambio de
 *   conducta: mismos tonos, misma API. Autoridad de forma: Diseño certifica.
 */

export type AlertaTono = "error" | "exito" | "advertencia" | "info";

type AlertaProps = {
    tono: AlertaTono;
    children: ReactNode;
    className?: string;
    role?: "alert" | "status";
    /** Oculta el icono para usos densos (default: visible). */
    sinIcono?: boolean;
};

/**
 * Color por función (§4.2). El fondo es el token base con alpha; el texto usa
 * la variante `-ink` vía `.text-estado-*` para cumplir contraste AA. El dark
 * lo resuelve la propia variable RGB del token — sin `dark:` duplicado, que es
 * lo que mata los 16 crudos del componente viejo.
 */
const TONOS: Record<AlertaTono, string> = {
    error: "bg-rubi/10 text-estado-rubi",
    exito: "bg-pino/10 text-estado-pino",
    advertencia: "bg-ambar/10 text-estado-ambar",
    info: "bg-cielo/10 text-estado-cielo",
};

/** Icono por función. `currentColor` hereda el color del estado. */
function IconoTono({ tono }: { tono: AlertaTono }) {
    const comun = {
        width: 18,
        height: 18,
        viewBox: "0 0 20 20",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
        className: "mt-0.5 shrink-0",
    };
    switch (tono) {
        case "exito":
            return (
                <svg {...comun}>
                    <path d="M4 10.5 8 14l8-8.5" />
                </svg>
            );
        case "advertencia":
            return (
                <svg {...comun}>
                    <path d="M10 3 18 17H2z" />
                    <path d="M10 8v4" />
                    <path d="M10 15h.01" />
                </svg>
            );
        case "error":
            return (
                <svg {...comun}>
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 6v5" />
                    <path d="M10 14h.01" />
                </svg>
            );
        case "info":
        default:
            return (
                <svg {...comun}>
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 9v5" />
                    <path d="M10 6h.01" />
                </svg>
            );
    }
}

export function Alerta({ tono, children, className = "", role = "alert", sinIcono = false }: AlertaProps) {
    return (
        <div
            role={role}
            className={`flex items-start gap-2.5 rounded-xl p-3 text-sm ${TONOS[tono]} ${className}`.trim()}
        >
            {!sinIcono && <IconoTono tono={tono} />}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
