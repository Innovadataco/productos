"use client";

import { useId } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-741 (Diseño · doc 333da98) · Sección PLEGABLE (disclosure) — el encabezado es el
 * disparador.
 *
 * - Encabezado = `<button aria-expanded aria-controls>` real (teclado/lector nativos);
 *   el panel es `role="region"` con `aria-labelledby`.
 * - El contenido se OCULTA (`hidden`), NO se desmonta: el formulario conserva su estado
 *   al plegar/desplegar (candado SPEC-741). El estado abierto/plegado lo controla el padre
 *   (por defecto TODAS recogidas, sin memoria entre visitas).
 * - Chevron ▸→▾: la misma flecha ▸ rota 90° al abrir (queda ▾), con transición ~180ms
 *   SÓLO bajo `motion-safe:` (el sistema la apaga con prefers-reduced-motion). El
 *   mostrar/ocultar del panel es instantáneo (sin animación de altura).
 * - `necesitaAtencion`: marcador ÁMBAR en el encabezado cuando la sección tiene un aviso
 *   pendiente, para verlo sin desplegar. No es sólo color (WCAG 1.4.1): el punto es
 *   `aria-hidden` y lo acompaña un texto para lector de pantalla.
 *
 * Es un disclosure de UNA sección (composable e inline), distinto del `Accordion` de array
 * (SPEC-146), que desmonta su contenido y no sirve cuando hay que conservar el form.
 */
export function SeccionColapsable({
    titulo,
    abierta,
    onToggle,
    necesitaAtencion = false,
    children,
    className = "",
}: {
    titulo: React.ReactNode;
    abierta: boolean;
    onToggle: () => void;
    necesitaAtencion?: boolean;
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
                        className={`inline-block text-subtle motion-safe:transition-transform motion-safe:duration-[180ms] ${abierta ? "rotate-90" : ""}`}
                    >
                        ▸
                    </span>
                    <span className="min-w-0 flex-1">{titulo}</span>
                    {necesitaAtencion && (
                        <span className="inline-flex items-center">
                            {/* Punto ámbar (señal visual) + texto oculto para lector (no sólo color). */}
                            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-estado-ambar" />
                            <span className="sr-only">requiere atención</span>
                        </span>
                    )}
                </button>
            </h2>
            <div id={panelId} role="region" aria-labelledby={headerId} hidden={!abierta}>
                {children}
            </div>
        </GlassCard>
    );
}

export default SeccionColapsable;
