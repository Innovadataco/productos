import type { ReactNode } from "react";

/**
 * SPEC-218 (002-PI-118): contenedor común de los widgets del dashboard
 * dinero-vs-valor. Paleta ambar del Módulo Pagos (D-74, FR-008).
 */
export function WidgetSeccion({
    titulo,
    total,
    children,
}: {
    titulo: string;
    total: number;
    children: ReactNode;
}) {
    return (
        <section className="glass rounded-3xl p-6" aria-label={titulo}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-body">{titulo}</h3>
                <span className="rounded-full bg-ambar/10 px-3 py-1 text-xs font-medium text-estado-ambar dark:bg-ambar/20 dark:text-ambar">
                    {total}
                </span>
            </div>
            {children}
        </section>
    );
}
