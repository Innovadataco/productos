"use client";

/**
 * SPEC-587 — Botón «Continúa con Google» (flujo PADRE).
 *
 * Logo «G» oficial en SVG multicolor inline (sin dependencia nueva) y navegación
 * completa a GET /api/auth/oauth/google (arranque del state + redirect 302 a
 * Google). El flujo por correo con enlace queda intacto arriba/debajo.
 */
import { Button } from "@/components/ui/Button";

function LogoGoogle() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
        </svg>
    );
}

/**
 * SPEC-631: `rol` elige el ENDPOINT de arranque (no viaja como parámetro editable — cada endpoint fija
 * su rol en el servidor y lo firma en el state). Sin `rol` → /login (solo autentica, no crea);
 * PARENT → registro de familia; PROFESIONAL → registro de profesional.
 * `label`/`conSeparador` (SPEC-623) mantienen por defecto el botón con separador. SPEC-631 (§2 de
 * Diseño, D-107): el rótulo por defecto es INFINITIVO «Continuar con Google» —voz-neutra que sirve a
 * familia (tú) y a colegio/profesional (usted)— en lugar del viejo «Continúa» (tú), que era defecto de
 * voz vivo en las puertas de usted. `recuperar` sigue pasando «Entrar con Google» (infinitivo neutro).
 */
const ENDPOINT_ARRANQUE: Record<"PARENT" | "PROFESIONAL", string> = {
    PARENT: "/api/auth/oauth/google/registro/familia",
    PROFESIONAL: "/api/auth/oauth/google/registro/profesional",
};

export function BotonContinuaConGoogle({
    label = "Continuar con Google",
    conSeparador = true,
    rol,
}: {
    label?: string;
    conSeparador?: boolean;
    rol?: "PARENT" | "PROFESIONAL";
} = {}) {
    const destino = rol ? ENDPOINT_ARRANQUE[rol] : "/api/auth/oauth/google";
    return (
        <div className="space-y-4">
            {conSeparador && (
                <div className="flex items-center gap-3" role="separator" aria-label="o continúa con Google">
                    <span className="h-px flex-1 bg-tinta/10" aria-hidden="true" />
                    <span className="text-xs text-muted">o</span>
                    <span className="h-px flex-1 bg-tinta/10" aria-hidden="true" />
                </div>
            )}
            <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                    window.location.href = destino;
                }}
            >
                <span className="flex items-center justify-center gap-2">
                    <LogoGoogle />
                    {label}
                </span>
            </Button>
        </div>
    );
}
