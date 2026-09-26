"use client";

import { useId } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

/** Tono del subtítulo de estado del encabezado (SPEC-741 · doc 333da98). */
export type TonoSeccion = "ok" | "atencion" | "neutral";

/**
 * SPEC-741 (Diseño · doc 333da98 · mockup 51e2b94) · Sección PLEGABLE (disclosure) — el
 * encabezado es el disparador y muestra un resumen del estado sin desplegar.
 *
 * - Encabezado = `<button aria-expanded aria-controls>` real (teclado/lector nativos);
 *   el panel es `role="region"` con `aria-labelledby`.
 * - El contenido se OCULTA (`hidden`), NO se desmonta: el formulario conserva su estado
 *   al plegar/desplegar (candado SPEC-741). El estado abierto/plegado lo controla el padre
 *   (por defecto TODAS recogidas, sin memoria entre visitas).
 * - «Encabezado informativo»: bajo el título va un `estado` (subtítulo) que resume la
 *   sección. Su `tono` lo colorea — `atencion` = ÁMBAR (la sección necesita atención),
 *   `ok` = pino, `neutral` = dato. NO es sólo color (WCAG 1.4.1): el estado es TEXTO y
 *   entra en el nombre accesible del botón, así que el lector lo anuncia.
 * - Chevron ▸→▾: la flecha ▸ rota 90° al abrir (queda ▾), transición ~180ms SÓLO bajo
 *   `motion-safe:` (el sistema la apaga con prefers-reduced-motion). El panel muestra/oculta
 *   instantáneo (sin animación de altura).
 *
 * Es un disclosure de UNA sección (composable e inline), distinto del `Accordion` de array
 * (SPEC-146), que desmonta su contenido y no sirve cuando hay que conservar el form.
 */
export function SeccionColapsable({
    titulo,
    estado,
    tono = "neutral",
    abierta,
    onToggle,
    children,
    className = "",
}: {
    titulo: React.ReactNode;
    estado?: React.ReactNode;
    tono?: TonoSeccion;
    abierta: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    const base = useId();
    const headerId = `${base}-header`;
    const panelId = `${base}-panel`;
    const claseEstado =
        tono === "atencion" ? "text-estado-ambar" : tono === "ok" ? "text-estado-pino" : "text-subtle";
    return (
        <GlassCard className={className}>
            <h2 className="m-0">
                <button
                    type="button"
                    id={headerId}
                    aria-expanded={abierta}
                    aria-controls={panelId}
                    onClick={onToggle}
                    className="ring-accent -mx-2 flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left motion-safe:transition-colors hover:bg-tinta/5"
                >
                    <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-body">{titulo}</span>
                        {estado != null && <span className={`mt-0.5 block text-sm ${claseEstado}`}>{estado}</span>}
                    </span>
                    <span
                        aria-hidden="true"
                        className={`inline-block flex-none text-subtle motion-safe:transition-transform motion-safe:duration-[180ms] ${abierta ? "rotate-90" : ""}`}
                    >
                        ▸
                    </span>
                </button>
            </h2>
            <div id={panelId} role="region" aria-labelledby={headerId} hidden={!abierta}>
                {children}
            </div>
        </GlassCard>
    );
}

export default SeccionColapsable;
