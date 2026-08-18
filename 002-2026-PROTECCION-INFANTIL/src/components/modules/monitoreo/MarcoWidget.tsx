/**
 * SPEC-171 (Pilar B) — Marco común de los widgets del tablero operativo.
 * Tarjeta de vidrio con título + estados de carga/error; el contenido lo pone
 * cada widget. Con autorefresco activo solo muestra spinner en la primera
 * carga (sin datos previos): los recargos no parpadean.
 */
import type { ReactNode } from "react";
import { Cargando } from "@/components/ui/Cargando";

type MarcoWidgetProps = {
    titulo: string;
    cargando: boolean;
    error: string | null;
    children: ReactNode;
};

export function MarcoWidget({ titulo, cargando, error, children }: MarcoWidgetProps) {
    return (
        <article className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-body">{titulo}</h3>
            {error ? (
                <p className="mt-3 text-xs text-rubi">{error}</p>
            ) : cargando ? (
                <Cargando inline tamano="sm" className="mt-3" texto="Actualizando..." />
            ) : (
                <div className="mt-3">{children}</div>
            )}
        </article>
    );
}
