import type { ReactNode } from "react";

type Tono = "verde" | "amarillo" | "rojo" | "gris";

const STYLES: Record<Tono, string> = {
    verde: "bg-emerald-100 text-emerald-800",
    amarillo: "bg-amber-100 text-amber-800",
    rojo: "bg-red-100 text-red-800",
    gris: "bg-slate-100 text-slate-700",
};

export function Badge({ tono, children }: { tono: Tono; children: ReactNode }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[tono]}`}>
            {children}
        </span>
    );
}
