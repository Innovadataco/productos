"use client";

/**
 * SPEC-557 (I-345) · Toast flotante de «Deshacer» tras una acción reversible.
 * SPEC-660 (Fase D): GENERALIZADO — antes traía la clasificación del reporte
 * acoplada (`categoria`/`nivelRiesgo`); ahora recibe un `mensaje` y lo usan dos
 * consumidores: la confirmación de clasificación del admin y el «Quitar cuenta»
 * del padre. Un segundo consumidor es justo lo que justifica generalizarlo.
 *
 * Regla de Diseño (frecuencia × reversibilidad): para una acción frecuente y/o
 * reversible, no modal (el modal repetido se vuelve clic automático, que es lo
 * que falló en I-345), sino DESHACER. La acción YA se ejecutó; este toast anclado
 * abajo dice QUÉ se hizo —así el usuario nota el error aunque no deshaga— y ofrece
 * [Deshacer] durante 8 s. Es `fixed`, NO anclado a la fila: **sobrevive a que la
 * fila desaparezca** (p. ej. un delete). El rollback real vive en el llamador
 * (`onDeshacer`); acá solo se dispara.
 *
 * La ventana de 8 s es del cliente (un setTimeout), no del servidor: no agrega
 * dependencia del reloj de pared a ninguna prueba.
 */
import { useEffect, useState } from "react";

const VENTANA_MS = 8000;

type Props = {
    /** Qué se hizo — el llamador lo arma (así el toast no conoce el dominio). */
    mensaje: React.ReactNode;
    onDeshacer: () => void;
    onExpirar: () => void;
    deshacerLabel?: string;
};

export function AvisoDeshacerConfirmacion({ mensaje, onDeshacer, onExpirar, deshacerLabel = "Deshacer" }: Props) {
    const [ancho, setAncho] = useState("100%");

    useEffect(() => {
        const raf = requestAnimationFrame(() => setAncho("0%"));
        const id = setTimeout(onExpirar, VENTANA_MS);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(id);
        };
    }, [onExpirar]);

    return (
        <div
            className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
            role="status"
            aria-live="polite"
        >
            <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-cielo/40 bg-superficie-2 shadow-lg dark:border-cielo/30">
                <div className="flex items-center gap-3 px-4 py-3">
                    <p className="min-w-0 flex-1 text-sm text-body">{mensaje}</p>
                    <button
                        type="button"
                        onClick={onDeshacer}
                        className="shrink-0 rounded-xl bg-cielo px-3 py-2 text-sm font-semibold text-white transition hover:bg-cielo/90"
                    >
                        {deshacerLabel}
                    </button>
                </div>
                {/* Barra de tiempo sutil: se agota en la ventana de 8 s. */}
                <div className="h-1 w-full bg-cielo/10">
                    <div
                        className="h-full bg-cielo/50 transition-[width] ease-linear"
                        style={{ width: ancho, transitionDuration: `${VENTANA_MS}ms` }}
                        aria-hidden="true"
                    />
                </div>
            </div>
        </div>
    );
}
