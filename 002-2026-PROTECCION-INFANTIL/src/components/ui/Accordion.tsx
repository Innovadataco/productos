"use client";

import { useRef } from "react";

/**
 * SPEC-146 (FR-004) — Primitivo Accordion (patrón de Modal.tsx, candado §9 del
 * brief: todo primitivo interactivo nuevo va con test de accesibilidad).
 *
 * - Cada encabezado es un `<button>` real con `aria-expanded` y `aria-controls`;
 *   el panel es `role="region"` con `aria-labelledby` (teclado nativo:
 *   Enter/Space alternan; ↑/↓/Home/End navegan entre encabezados).
 * - Foco visible siempre (`ring-accent` — token del sistema §4.2) y tap
 *   target ≥ 48px (`min-h-12`).
 * - Movimiento: las transiciones van bajo `motion-safe:` y el sistema apaga
 *   TODO con `prefers-reduced-motion` (globals §4.5).
 * - Controlado: el estado de qué secciones están abiertas vive en el padre
 *   (el wizard lo usa para su indicador de pasos).
 */

export interface AccordionSeccion {
    id: string;
    titulo: React.ReactNode;
    /** Contenido a la derecha del encabezado (contador, "opcional", …). */
    detalle?: React.ReactNode;
    contenido: React.ReactNode;
}

export interface AccordionProps {
    secciones: AccordionSeccion[];
    abiertos: string[];
    onToggle: (id: string) => void;
    className?: string;
}

export function Accordion({ secciones, abiertos, onToggle, className = "" }: AccordionProps) {
    const headersRef = useRef<Array<HTMLButtonElement | null>>([]);

    function enfocarHeader(indice: number) {
        const acotado = (indice + secciones.length) % secciones.length;
        headersRef.current[acotado]?.focus();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, indice: number) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            enfocarHeader(indice + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            enfocarHeader(indice - 1);
        } else if (event.key === "Home") {
            event.preventDefault();
            enfocarHeader(0);
        } else if (event.key === "End") {
            event.preventDefault();
            enfocarHeader(secciones.length - 1);
        }
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {secciones.map((seccion, indice) => {
                const abierta = abiertos.includes(seccion.id);
                const headerId = `accordion-header-${seccion.id}`;
                const panelId = `accordion-panel-${seccion.id}`;
                return (
                    <section key={seccion.id} className="glass overflow-hidden rounded-[var(--radio-card)] shadow-sm">
                        <h3>
                            <button
                                ref={(el) => {
                                    headersRef.current[indice] = el;
                                }}
                                type="button"
                                id={headerId}
                                aria-expanded={abierta}
                                aria-controls={panelId}
                                onClick={() => onToggle(seccion.id)}
                                onKeyDown={(e) => handleKeyDown(e, indice)}
                                className="ring-accent flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold text-body motion-safe:transition-colors hover:bg-tinta/5"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`inline-block text-subtle motion-safe:transition-transform ${abierta ? "rotate-90" : ""}`}
                                >
                                    ▶
                                </span>
                                <span className="min-w-0 flex-1">{seccion.titulo}</span>
                                {seccion.detalle ? <span className="shrink-0 text-sm font-normal text-subtle">{seccion.detalle}</span> : null}
                            </button>
                        </h3>
                        {abierta ? (
                            <div
                                id={panelId}
                                role="region"
                                aria-labelledby={headerId}
                                className="border-t border-tinta/10 px-4 py-4 sm:px-6"
                            >
                                {seccion.contenido}
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}

export default Accordion;
