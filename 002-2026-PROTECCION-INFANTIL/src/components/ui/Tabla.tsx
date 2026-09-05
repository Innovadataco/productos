import type { ReactNode } from "react";

/**
 * SPEC-124 (R7) — Primitiva de tabla compartida.
 * Reproduce el patrón copy-paste canónico del repo:
 * contenedor `glass rounded-2xl` + scroll horizontal +
 * `<table className="w-full text-left text-sm">`.
 */

type TablaProps = {
    children: ReactNode;
    /** true cuando la tabla ya vive dentro de una card/contenedor propio. */
    sinContenedor?: boolean;
    className?: string;
    "aria-label"?: string;
};

export function Tabla({ children, sinContenedor = false, className = "", ...rest }: TablaProps) {
    const tabla = (
        <div className="overflow-x-auto">
            <table className={`w-full text-left text-sm ${className}`.trim()} {...rest}>
                {children}
            </table>
        </div>
    );
    if (sinContenedor) return tabla;
    return <div className="glass rounded-2xl overflow-hidden">{tabla}</div>;
}

type TablaHeadProps = {
    children: ReactNode;
    /** "relleno": fondo slate; "borde": solo borde inferior. */
    variante?: "relleno" | "borde";
    className?: string;
};

export function TablaHead({ children, variante = "relleno", className = "" }: TablaHeadProps) {
    // SPEC-469 · Tabla al Sistema de Diseño (catálogo §2): color por token, sin
    // líneas verticales ni zebra — separación por espacio/tono (`divide-y` +
    // wash de tinta), no por rejilla. El token de tinta voltea solo en oscuro.
    const base =
        variante === "relleno"
            ? "bg-tinta/5 text-subtle"
            : "border-b border-tinta/10";
    return <thead className={`${base} ${className}`.trim()}>{children}</thead>;
}

type TablaBodyProps = {
    children: ReactNode;
    className?: string;
};

export function TablaBody({ children, className = "" }: TablaBodyProps) {
    return (
        <tbody className={`divide-y divide-tinta/10 ${className}`.trim()}>
            {children}
        </tbody>
    );
}
