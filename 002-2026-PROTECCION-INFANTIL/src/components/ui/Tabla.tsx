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
    const base =
        variante === "relleno"
            ? "bg-slate-100/70 dark:bg-slate-800/60 text-subtle"
            : "border-b border-slate-200 dark:border-slate-800";
    return <thead className={`${base} ${className}`.trim()}>{children}</thead>;
}

type TablaBodyProps = {
    children: ReactNode;
    className?: string;
};

export function TablaBody({ children, className = "" }: TablaBodyProps) {
    return (
        <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 ${className}`.trim()}>
            {children}
        </tbody>
    );
}
