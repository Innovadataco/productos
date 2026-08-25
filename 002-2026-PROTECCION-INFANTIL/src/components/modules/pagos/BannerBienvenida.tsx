"use client";

import { useState } from "react";

/**
 * SPEC-247 (002-PI-150): banner de bienvenida tras activación de suscripción.
 * D-72 · color pino. Es dismissible y anuncia el inicio del servicio.
 */
export function BannerBienvenida() {
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    return (
        <div
            role="status"
            className="relative rounded-2xl bg-pino p-5 text-white shadow-lg shadow-pino/25"
        >
            <div className="pr-10">
                <h2 className="text-lg font-bold">¡Bienvenido a Protección Infantil!</h2>
                <p className="mt-1 text-sm text-white/90">
                    Tu suscripción está activa. Ya puedes usar todas las funciones de tu cuenta.
                </p>
            </div>
            <button
                type="button"
                onClick={() => setVisible(false)}
                aria-label="Cerrar mensaje de bienvenida"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
                <span aria-hidden="true">✕</span>
            </button>
        </div>
    );
}
