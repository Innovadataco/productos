"use client";

import { useId } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-741 · Sección PLEGABLE (disclosure) — el encabezado es el disparador.
 *
 * - Encabezado = `<button aria-expanded aria-controls>` real (teclado/lector nativos);
 *   el panel es `role="region"` con `aria-labelledby`.
 * - El contenido se OCULTA (`hidden`), NO se desmonta: el formulario conserva su estado
 *   al plegar/desplegar (candado SPEC-741). El estado abierto/plegado lo controla el padre.
 * - Movimiento sólo bajo `motion-safe:` (el sistema apaga todo con prefers-reduced-motion);
 *   el mostrar/ocultar es instantáneo, sin animación de altura.
 *
 * Es un disclosure de UNA sección (composable e inline), distinto del `Accordion` de array
 * (SPEC-146), que desmonta su contenido y no sirve cuando hay que conservar el form.
 */
export function SeccionColapsable({
    titulo,
    abierta,
    onToggle,
    children,
    className = "",
}: {
    titulo: React.ReactNode;
    abierta: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    const base = useId();
    const headerId = `${base}-header`;
    const panelId = `${base}-panel`;
    return (
        <GlassCard className={className}>
            <h2 className="m-0">
                <button
                    type="button"
                    id={headerId}
                    aria-expanded={abierta}
                    aria-controls={panelId}
                    onClick={onToggle}
                    className="ring-accent -mx-2 flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left text-lg font-semibold text-body motion-safe:transition-colors hover:bg-tinta/5"
                >
                    <span
                        aria-hidden="true"
                        className={`inline-block text-subtle motion-safe:transition-transform ${abierta ? "rotate-90" : ""}`}
                    >
                        ▶
                    </span>
                    <span className="min-w-0 flex-1">{titulo}</span>
                </button>
            </h2>
            <div id={panelId} role="region" aria-labelledby={headerId} hidden={!abierta}>
                {children}
            </div>
        </GlassCard>
    );
}

export default SeccionColapsable;
