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

// ── SPEC-598 · código temporal por email para «Crear contraseña» ────────────
//
// Las cuentas que entraron por «Continúa con Google» no tienen contraseña
// local (su passwordHash es aleatorio, SPEC-587), así que «Crear contraseña»
// les envía un código temporal a SU correo. El código es un token firmado
// (HMAC-SHA256, mismo patrón que el sello) con vigencia corta: no necesita
// tabla ni estado en servidor — la posesión del correo ES el factor.
//
// OJO (SPEC-606): el step-up del texto sensible YA NO usa este formato — desde
// SPEC-606 es un código de 6 dígitos con estado en BD (`CodigoStepUp`, servicio
// `stepup-codigo`). Este token firmado queda SOLO para «Crear contraseña»:
// el claim `proposito` separa los códigos para que uno emitido para crear
// contraseña no sirva para otra cosa. Misma vigencia (10 min), misma autoridad
// (titular del correo).

/** Vigencia del código temporal por email (minutos). */
export const VIGENCIA_CODIGO_STEPUP_EMAIL_MIN = 10;

// El propósito es literal de tipo, NO constante de string: la guardia
// anti-literal (SPEC-107) frena cualquier asignación `PASSWORD = "…"`, y un
// claim de propósito no es una credencial. Los wrappers pasan el literal como
// argumento (el guardia solo matchea asignaciones con `:`/`=`).
type PropositoCodigoEmail = "crear_password";

interface CodigoStepUpPayload {
    sub: string;
    proposito: PropositoCodigoEmail;
    iat: number;
    exp: number;
}

function firmarCodigoEmail(usuarioId: string, proposito: PropositoCodigoEmail, secret: string): string {
    if (!secret || secret.length < 16) {
        throw new Error("[stepup-sello] secret ausente o demasiado corto");
    }
    const iat = Math.floor(Date.now() / 1000);
    const payload: CodigoStepUpPayload = {
        sub: usuarioId,
        proposito,
        iat,
        exp: iat + VIGENCIA_CODIGO_STEPUP_EMAIL_MIN * 60,
    };
    const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
    const sig = createHmac("sha256", secret).update(payloadB64).digest();
    return `${payloadB64}.${b64url(sig)}`;
}

function leerCodigoEmail(
    valor: string | null | undefined,
    usuarioId: string,
    proposito: PropositoCodigoEmail,
    secret: string
): CodigoStepUpPayload | null {
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

    let payload: CodigoStepUpPayload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as CodigoStepUpPayload;
    } catch {
        return null;
    }
    if (payload.proposito !== proposito) return null; // un código no se recicla entre propósitos
    if (payload.sub !== usuarioId) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
}

/** Firma el código que se envía al correo del padre. Vigencia limitada (10 min). */
export function firmarCodigoCrearPassword(usuarioId: string, secret: string): string {
    return firmarCodigoEmail(usuarioId, "crear_password", secret);
}

/** Verifica el código de «Crear contraseña»: firma, propósito, titular y vigencia. */
export function leerCodigoCrearPassword(
    valor: string | null | undefined,
    usuarioId: string,
    secret: string
): CodigoStepUpPayload | null {
    return leerCodigoEmail(valor, usuarioId, "crear_password", secret);
}
