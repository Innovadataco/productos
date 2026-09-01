/**
 * SPEC-287 (002-PI-187) — Cookie firmada `sesion_estado`.
 *
 * Un solo payload firmado con los 3 flags que el middleware necesita para
 * decidir sin tocar Prisma en Edge:
 *   - `vigencia`: estado de la suscripción (ACTIVA, EN_GRACIA, ..., SIN_SUSCRIPCION)
 *   - `requiereConsentimiento`: si el usuario debe firmar el consentimiento (SPEC-241)
 *   - `debeCambiarPassword`: si el usuario debe cambiar contraseña obligatoriamente
 *   - `pasoCamino`: paso pendiente del camino guiado del padre (SPEC-339), o
 *     `null` si el camino está terminado o el usuario no es padre
 *
 * Fuente única de estado de sesión en Edge. Se refresca al llegar (o al expirar el
 * TTL) por `POST /api/vigencia/refresh` (Node runtime, corre Prisma). Firmada
 * HMAC-SHA256 con `JWT_SECRET` para que un cliente no pueda falsificarla.
 *
 * Nombre del archivo se conserva por historia (SPEC-242 usaba solo vigencia);
 * el nombre de la cookie sí cambia a `sesion_estado` porque ya cubre 3 flags.
 */
import type { EstadoVigenciaEfectivo } from "@/lib/pagos/vigencia-middleware";
import { esPasoCamino, type PasoPendiente } from "@/lib/camino/pasos";
import { esPasoColegio, type PasoPendienteColegio } from "@/lib/camino/pasos-colegio";

export const NOMBRE_COOKIE = "sesion_estado";
export const TTL_SEG = 300; // 5 minutos

export interface SesionEstadoPayload {
    vigencia: EstadoVigenciaEfectivo;
    requiereConsentimiento: boolean;
    debeCambiarPassword: boolean;
    // SPEC-339 (A-67) + SPEC-344 (A-69): paso pendiente del camino guiado.
    // Acepta valores del padre (`PasoPendiente`) o del colegio
    // (`PasoPendienteColegio`). `null` = camino terminado, o el usuario
    // no recorre camino guiado.
    pasoCamino: PasoPendiente | PasoPendienteColegio;
    iat: number; // unix seconds
}

function base64url(bytes: Uint8Array): string {
    // Compatible con Edge runtime (no Buffer)
    let str = "";
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlToBytes(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
}

async function hmac(secret: string, msg: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
    return new Uint8Array(sig);
}

function bytesEqualConstantTime(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

/** Firma el estado de sesión y devuelve la cookie serializada. */
export async function firmarSesionEstado(
    estado: Omit<SesionEstadoPayload, "iat">,
    secret: string,
): Promise<string> {
    if (!secret || secret.length < 16) {
        throw new Error("[sesion-estado-cookie] secret ausente o demasiado corto");
    }
    const payload: SesionEstadoPayload = { ...estado, iat: Math.floor(Date.now() / 1000) };
    const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const sig = await hmac(secret, payloadB64);
    return `${payloadB64}.${base64url(sig)}`;
}

/**
 * Verifica firma y TTL. Devuelve el payload si válido, o `null` si:
 *   - formato malo
 *   - firma inválida (rechazo constante en tiempo)
 *   - `iat` en el futuro
 *   - TTL vencido (`now - iat > maxAgeSec`)
 */
export async function leerSesionEstado(
    cookieValue: string | null | undefined,
    secret: string,
    maxAgeSec: number = TTL_SEG,
): Promise<SesionEstadoPayload | null> {
    if (!cookieValue) return null;
    const partes = cookieValue.split(".");
    if (partes.length !== 2) return null;
    const [payloadB64, sigB64] = partes;

    let sigProvista: Uint8Array;
    try {
        sigProvista = base64urlToBytes(sigB64);
    } catch {
        return null;
    }

    const sigEsperada = await hmac(secret, payloadB64);
    if (!bytesEqualConstantTime(sigProvista, sigEsperada)) return null;

    let payload: SesionEstadoPayload;
    try {
        payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64))) as SesionEstadoPayload;
    } catch {
        return null;
    }

    if (typeof payload.iat !== "number") return null;
    if (typeof payload.vigencia !== "string") return null;
    if (typeof payload.requiereConsentimiento !== "boolean") return null;
    if (typeof payload.debeCambiarPassword !== "boolean") return null;
    // SPEC-339 (validación estricta) + SPEC-344 (extensión colegio): el
    // campo acepta un paso del padre O del colegio. Cookies emitidas antes
    // del despliegue del colegio siguen validando (valores del padre); una
    // cookie sin el campo se descarta y se re-sella en el rebote.
    if (
        payload.pasoCamino !== null &&
        !esPasoCamino(payload.pasoCamino) &&
        !esPasoColegio(payload.pasoCamino)
    ) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + 5) return null; // sesgo de reloj tolerado 5s
    if (now - payload.iat > maxAgeSec) return null;

    return payload;
}
