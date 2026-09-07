"use client";

import { sugerirDominioCorreo, aplicarSugerenciaDominio } from "@/lib/email-typo";

/**
 * 3003 — sugerencia en vivo de dominio mal escrito (`gmaail.com` → gmail.com)
 * bajo el campo de correo. Un toque corrige el valor. El servidor aplica la
 * MISMA regla (validators.ts) como barrera de verdad al enviar.
 */
export function SugerenciaDominio({ email, onAplicar }: { email: string; onAplicar: (corregido: string) => void }) {
    const sugerencia = email.includes("@") ? sugerirDominioCorreo(email) : null;
    if (!sugerencia) return null;
    const corregido = aplicarSugerenciaDominio(email, sugerencia);
    return (
        <button
            type="button"
            onClick={() => onAplicar(corregido)}
            className="block w-full rounded-xl bg-ambar/10 px-3 py-2 text-left text-xs text-estado-ambar transition hover:opacity-80"
        >
            ¿Quisiste decir <span className="font-semibold">{corregido}</span>? Toca para corregir
        </button>
    );
}
