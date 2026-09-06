"use client";

/**
 * SPEC-548 (I-337) · Caso (a): hay versión nueva, nada está roto.
 *
 * Forma cerrada por Diseño (FORMA-AVISO-VERSION-SPEC548): toast discreto anclado
 * ABAJO, sobre el chrome, SIN tapar contenido; acento cielo (mejora, no alarma);
 * descartable con la ×. Regla que manda: nunca modal, nunca rojo, nunca sobre el
 * contenido — quien lo ve puede ser un padre leyendo una alerta sobre su hijo.
 *
 * Al descartar, no vuelve a molestar en ESTA vista; reaparece discreto en la
 * próxima navegación (se reevalúa por `pathname`). Se ancla encima del nav
 * inferior del padre, no sobre él. Entrada suave vía `.anim-entrada`, que el
 * `prefers-reduced-motion` global apaga.
 */
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useDeteccionVersion } from "./useDeteccionVersion";

export function AvisoVersionNueva() {
    const hayNueva = useDeteccionVersion();
    const pathname = usePathname();
    const [descartadoEn, setDescartadoEn] = useState<string | null>(null);

    // Descartado solo cuenta en la vista donde se cerró; al navegar, reaparece.
    const visible = hayNueva && descartadoEn !== pathname;
    if (!visible) return null;

    return (
        <div
            className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6"
            role="status"
            aria-live="polite"
        >
            <div className="anim-entrada pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-cielo/40 bg-papel/95 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-cielo/30 dark:bg-tinta/95">
                <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cielo/15 text-cielo"
                    aria-hidden="true"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 1 12.9-5.3L19.5 9m0 0V4.5M19.5 9H15m4.5 3a7.5 7.5 0 0 1-12.9 5.3L4.5 15m0 0v4.5M4.5 15H9" />
                    </svg>
                </span>
                <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-body">Hay una versión nueva.</p>
                    <p className="text-muted">Actualiza cuando quieras para tener lo último.</p>
                </div>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="shrink-0 rounded-xl bg-cielo px-3 py-2 text-sm font-semibold text-white transition hover:bg-cielo/90"
                >
                    Actualizar
                </button>
                <button
                    type="button"
                    onClick={() => setDescartadoEn(pathname)}
                    aria-label="Descartar aviso de versión nueva"
                    className="shrink-0 rounded-lg p-1 text-muted transition hover:text-body"
                >
                    <span aria-hidden="true" className="text-lg leading-none">×</span>
                </button>
            </div>
        </div>
    );
}
