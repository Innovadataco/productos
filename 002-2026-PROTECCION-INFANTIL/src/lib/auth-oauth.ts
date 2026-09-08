/**
 * SPEC-587 — OAuth 2.0 de Google para el flujo PADRE.
 *
 * Helpers puros + llamadas al proveedor: firma/verificación del `state`
 * (HMAC-SHA256 con JWT_SECRET, payload { nonce, exp }), construcción de la
 * auth URL, intercambio code→token y lectura de userinfo. Solo para el flujo
 * PADRE; profesional/colegio conservan su verificación institucional.
 *
 * Los secretos (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) viven SOLO en
 * variables de entorno; este módulo nunca los loguea.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireEnv } from "./env";
import { AppError, ERROR_CODES } from "./errors";

/** Vida útil del state (y de su cookie): 10 minutos. */
export const OAUTH_STATE_TTL_SEG = 600;

export const OAUTH_STATE_COOKIE = "oauth_state";

const OAUTH_TIMEOUT_MS = 10_000;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function claveHmac(): string {
    return requireEnv("JWT_SECRET", 32);
}

function b64url(datos: string | Buffer): string {
    return Buffer.from(datos).toString("base64url");
}

export interface EstadoOauth {
    nonce: string;
    exp: number;
}

/**
 * Firma un state nuevo: `<base64url(json)>.<base64url(hmac)>`. `ahora` es
 * inyectable para tests (expiración determinista).
 */
export function firmarState(ahora: number = Date.now()): string {
    const payload: EstadoOauth = {
        nonce: randomBytes(16).toString("hex"),
        exp: Math.floor(ahora / 1000) + OAUTH_STATE_TTL_SEG,
    };
    const datos = b64url(JSON.stringify(payload));
    const firma = createHmac("sha256", claveHmac()).update(datos).digest();
    return `${datos}.${b64url(firma)}`;
}

/**
 * Verifica firma (comparación con tiempo constante) y expiración del state.
 */
export function verificarState(state: string, ahora: number = Date.now()): boolean {
    const punto = state.indexOf(".");
    if (punto <= 0 || punto === state.length - 1) return false;
    const datos = state.slice(0, punto);
    const firmaRecibida = Buffer.from(state.slice(punto + 1), "base64url");
    const firmaEsperada = createHmac("sha256", claveHmac()).update(datos).digest();
    if (firmaRecibida.length !== firmaEsperada.length || !timingSafeEqual(firmaRecibida, firmaEsperada)) {
        return false;
    }
    try {
        const payload = JSON.parse(Buffer.from(datos, "base64url").toString("utf8")) as EstadoOauth;
        return (
            typeof payload.nonce === "string" &&
            payload.nonce.length > 0 &&
            typeof payload.exp === "number" &&
            payload.exp * 1000 > ahora
        );
    } catch {
        return false;
    }
}

/**
 * URL del callback registrada en Google. El origen SIEMPRE sale de
 * `NEXT_PUBLIC_APP_URL` (canalón canónico de URLs públicas del producto):
 * `request.url` refleja el host interno del contenedor (0.0.0.0:3000) cuando
 * el reverse proxy no reescribe Host, y Google exige coincidencia exacta con
 * la URI autorizada. Fallback a request solo si el env falta.
 */
export function callbackUriDe(request: Request): string {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (base) return new URL("/api/auth/oauth/google/callback", base).toString();
    return new URL("/api/auth/oauth/google/callback", request.url).toString();
}

/** Auth URL de Google (scope openid email profile · prompt select_account). */
export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
    });
    return `${AUTH_URL}?${params.toString()}`;
}

/** Intercambio code→token. Devuelve el access_token o lanza AppError 502. */
export async function intercambiarCodePorToken(code: string, redirectUri: string): Promise<string> {
    let res: Response;
    try {
        res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: requireEnv("GOOGLE_CLIENT_ID"),
                client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
        });
    } catch {
        throw new AppError(
            "No pudimos comunicarnos con Google. Intenta de nuevo.",
            ERROR_CODES.BAD_GATEWAY,
            502
        );
    }
    if (!res.ok) {
        throw new AppError(
            "Google no validó el código de autorización. Intenta de nuevo.",
            ERROR_CODES.BAD_GATEWAY,
            502
        );
    }
    const data: unknown = await res.json();
    if (
        data &&
        typeof data === "object" &&
        "access_token" in data &&
        typeof (data as { access_token: unknown }).access_token === "string"
    ) {
        return (data as { access_token: string }).access_token;
    }
    throw new AppError(
        "La respuesta de Google no trajo credencial de acceso. Intenta de nuevo.",
        ERROR_CODES.BAD_GATEWAY,
        502
    );
}

export interface InfoUsuarioGoogle {
    sub: string;
    email: string;
    emailVerified: boolean;
    nombre?: string | undefined;
}

function parsearUserinfo(data: unknown): InfoUsuarioGoogle {
    if (!data || typeof data !== "object") {
        throw new AppError("La respuesta de Google vino incompleta. Intenta de nuevo.", ERROR_CODES.BAD_GATEWAY, 502);
    }
    const info = data as Record<string, unknown>;
    if (typeof info.sub !== "string" || typeof info.email !== "string" || typeof info.email_verified !== "boolean") {
        throw new AppError("La respuesta de Google vino incompleta. Intenta de nuevo.", ERROR_CODES.BAD_GATEWAY, 502);
    }
    return {
        sub: info.sub,
        email: info.email,
        emailVerified: info.email_verified,
        ...(typeof info.name === "string" ? { nombre: info.name } : {}),
    };
}

/** Userinfo (OIDC v3). Devuelve sub/email/email_verified o lanza AppError 502. */
export async function obtenerInfoUsuarioGoogle(accessToken: string): Promise<InfoUsuarioGoogle> {
    let res: Response;
    try {
        res = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
        });
    } catch {
        throw new AppError(
            "No pudimos comunicarnos con Google. Intenta de nuevo.",
            ERROR_CODES.BAD_GATEWAY,
            502
        );
    }
    if (!res.ok) {
        throw new AppError(
            "Google no entregó los datos de la cuenta. Intenta de nuevo.",
            ERROR_CODES.BAD_GATEWAY,
            502
        );
    }
    return parsearUserinfo(await res.json());
}
