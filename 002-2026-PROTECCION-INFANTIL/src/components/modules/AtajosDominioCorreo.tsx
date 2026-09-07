"use client";

import { ATAJOS_DOMINIO, completarDominio } from "@/lib/email-typo";

/**
 * 3003 — atajos de dominio: fila de botones de un toque (gmail.com, hotmail.com…)
 * que agregan o reemplazan SOLO el dominio del correo. El dominio lo escribe el
 * botón, no el teclado → el typo de dominio es imposible por este camino. Chips
 * neutros (sin logos de marca) por respeto al sistema de diseño.
 */
export function AtajosDominioCorreo({ email, onAplicar }: { email: string; onAplicar: (corregido: string) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Dominio rápido:</span>
            {ATAJOS_DOMINIO.map((dominio) => (
                <button
                    key={dominio}
                    type="button"
                    onClick={() => onAplicar(completarDominio(email, dominio))}
                    className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-body transition hover:opacity-80"
                >
                    <EnvelopeIcon />
                    {dominio}
                </button>
            ))}
        </div>
    );
}

function EnvelopeIcon() {
    return (
        <svg className="h-3 w-3 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
        </svg>
    );
}
