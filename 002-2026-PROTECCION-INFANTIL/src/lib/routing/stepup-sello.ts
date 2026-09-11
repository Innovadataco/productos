/**
 * SPEC-340 (A-68 §3.3-bis) — el sello del step-up del texto sensible.
 *
 * Cookie firmada (HMAC-SHA256, mismo patrón que `sesion_estado`) que dice «este
 * usuario revalidó su contraseña hace menos de M minutos». Cookie SEPARADA de
 * `sesion_estado` a propósito: aquella viaja en cada request y la lee el
 * middleware en Edge — engordarla por una función que solo usan dos rutas de
 * detalle sería pagar en todas partes por algo que se usa en una.
 *
 * La AUTORIDAD es del servidor: el que decide si entrega el texto es la ruta
 * de detalle validando este sello (o la edad del JWT) — el cliente solo pinta.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const NOMBRE_COOKIE_STEPUP = "stepup_sello";

interface SelloPayload {
    sub: string;
    iat: number; // unix seconds
}

function b64url(buf: Buffer): string {
    return buf.toString("base64url");
}

export function firmarSelloStepUp(usuarioId: string, secret: string): string {
    if (!secret || secret.length < 16) {
        throw new Error("[stepup-sello] secret ausente o demasiado corto");
    }
    const payload: SelloPayload = { sub: usuarioId, iat: Math.floor(Date.now() / 1000) };
    const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
    const sig = createHmac("sha256", secret).update(payloadB64).digest();
    return `${payloadB64}.${b64url(sig)}`;
}

/** Devuelve el payload si el sello es válido, del usuario, y más joven que maxAgeSec. */
export function leerSelloStepUp(
    valor: string | null | undefined,
    usuarioId: string,
    secret: string,
    maxAgeSec: number
): SelloPayload | null {
    if (!valor) return null;
    const partes = valor.split(".");
    if (partes.length !== 2) return null;
    const [payloadB64, sigB64] = partes;

    let sigProvista: Buffer;
    try {
        sigProvista = Buffer.from(sigB64, "base64url");
    } catch {
        return null;
    }
    const sigEsperada = createHmac("sha256", secret).update(payloadB64).digest();
    if (sigProvista.length !== sigEsperada.length || !timingSafeEqual(sigProvista, sigEsperada)) {
        return null;
    }

    let payload: SelloPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SelloPayload;
    } catch {
        return null;
    }
    if (typeof payload.iat !== "number" || typeof payload.sub !== "string") return null;
    if (payload.sub !== usuarioId) return null; // el sello no es transferible

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + 5) return null;
    if (now - payload.iat > maxAgeSec) return null;
    return payload;
}
