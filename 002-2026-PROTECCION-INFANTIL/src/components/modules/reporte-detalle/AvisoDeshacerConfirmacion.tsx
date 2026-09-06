"use client";

/**
 * SPEC-557 (I-345) · Toast de «Deshacer» tras confirmar una clasificación.
 *
 * Regla de Diseño (frecuencia × reversibilidad): clasificar es FRECUENTE y
 * REVERSIBLE → no modal (el modal repetido se vuelve clic automático, que es lo
 * que falló), sino DESHACER. La acción ya se ejecutó; este toast anclado abajo
 * (no tapa el expediente) dice QUÉ se hizo —así el operador nota el error aunque
 * no deshaga— y ofrece [Deshacer] durante 8 s. El rollback real (sacar de público,
 * revertir estado, liberar la corrección) vive en el endpoint; acá solo se dispara.
 *
 * La ventana de 8 s es del cliente (un setTimeout), no del servidor: no agrega
 * dependencia del reloj de pared a ninguna prueba. La barra de tiempo es sutil.
 */
import { useEffect, useState } from "react";
import { formatCategoria } from "./types";

const VENTANA_MS = 8000;

type Props = {
    categoria: string;
    nivelRiesgo: string;
    onDeshacer: () => void;
    onExpirar: () => void;
};

export function AvisoDeshacerConfirmacion({ categoria, nivelRiesgo, onDeshacer, onExpirar }: Props) {
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
            <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-cielo/40 bg-papel/95 shadow-lg backdrop-blur-xl dark:border-cielo/30 dark:bg-tinta/95">
                <div className="flex items-center gap-3 px-4 py-3">
                    <p className="min-w-0 flex-1 text-sm text-body">
                        Clasificación aceptada: <span className="font-semibold">{formatCategoria(categoria)}</span>
                        {nivelRiesgo ? <> · riesgo {nivelRiesgo.toLowerCase()}</> : null}
                    </p>
                    <button
                        type="button"
                        onClick={onDeshacer}
                        className="shrink-0 rounded-xl bg-cielo px-3 py-2 text-sm font-semibold text-white transition hover:bg-cielo/90"
                    >
                        Deshacer
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
