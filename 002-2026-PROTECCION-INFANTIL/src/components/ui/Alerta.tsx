import type { ReactNode } from "react";

/**
 * SPEC-124 (R7) — Alerta inline compartida.
 * Unifica las cajas copy-paste `rounded-xl bg-{color}-50 ... p-3 text-sm`.
 */

export type AlertaTono = "error" | "exito" | "advertencia" | "info";

type AlertaProps = {
    tono: AlertaTono;
    children: ReactNode;
    className?: string;
    role?: "alert" | "status";
};

const TONOS: Record<AlertaTono, string> = {
    error: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    exito: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    advertencia: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
};

export function Alerta({ tono, children, className = "", role = "alert" }: AlertaProps) {
    return (
        <div role={role} className={`rounded-xl p-3 text-sm ${TONOS[tono]} ${className}`.trim()}>
            {children}
        </div>
    );
}
