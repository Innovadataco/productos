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
import type { RolUsuario } from "@prisma/client";
import { requireEnv } from "./env";
import { AppError, ERROR_CODES } from "./errors";

/**
 * SPEC-631 (I-378): roles que un usuario PUEDE auto-registrarse por Google. SCHOOL_ADMIN queda AFUERA
 * (el colegio es por invitación de admin, multi-entidad: Colegio+Tenant+rector); los internos
 * (ADMIN, OPERADOR, los COMITE y VERIFICADOR) los crea un admin. El rol de un alta por Google viaja SOLO en
 * el `state` firmado (HMAC), jamás en la URL, y se re-valida contra este allowlist AL CREAR (Datos).
 */
export const ROLES_AUTORREGISTRABLES_GOOGLE: readonly RolUsuario[] = ["PARENT", "PROFESIONAL"];

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
    /** SPEC-631: presente SOLO en el arranque de un REGISTRO por rol; ausente = login (no crea). */
    rol?: RolUsuario;
}

/**
 * Firma un state nuevo: `<base64url(json)>.<base64url(hmac)>`. `ahora` es inyectable para tests.
 * SPEC-631: si se pide con `rol`, tiene que ser auto-registrable por Google (defensa en el firmado;
 * el allowlist se re-valida AL CREAR). El botón de /login firma SIN rol → el callback no crea.
 */
export function firmarState(rol?: RolUsuario, ahora: number = Date.now()): string {
    if (rol !== undefined && !ROLES_AUTORREGISTRABLES_GOOGLE.includes(rol)) {
        throw new Error(`[oauth-state] rol no auto-registrable por Google: ${rol}`);
    }
    const payload: EstadoOauth = {
        nonce: randomBytes(16).toString("hex"),
        exp: Math.floor(ahora / 1000) + OAUTH_STATE_TTL_SEG,
        ...(rol !== undefined ? { rol } : {}),
    };
    const datos = b64url(JSON.stringify(payload));
    const firma = createHmac("sha256", claveHmac()).update(datos).digest();
    return `${datos}.${b64url(firma)}`;
}

export interface StateLeido {
    valido: boolean;
    /** El rol FIRMADO (si lo hay). Viene del payload HMAC, NUNCA de la URL. Ausente = login. */
    rol?: RolUsuario;
}

/**
 * Verifica firma (tiempo constante) + expiración y devuelve el rol firmado. La validación de allowlist
 * AL CREAR vive en el servicio (gate de Datos, SPEC-631): acá solo se lee lo que el HMAC ampara.
 */
export function leerState(state: string, ahora: number = Date.now()): StateLeido {
    const punto = state.indexOf(".");
    if (punto <= 0 || punto === state.length - 1) return { valido: false };
    const datos = state.slice(0, punto);
    const firmaRecibida = Buffer.from(state.slice(punto + 1), "base64url");
    const firmaEsperada = createHmac("sha256", claveHmac()).update(datos).digest();
    if (firmaRecibida.length !== firmaEsperada.length || !timingSafeEqual(firmaRecibida, firmaEsperada)) {
        return { valido: false };
    }
    try {
        const payload = JSON.parse(Buffer.from(datos, "base64url").toString("utf8")) as EstadoOauth;
        const ok =
            typeof payload.nonce === "string" &&
            payload.nonce.length > 0 &&
            typeof payload.exp === "number" &&
            payload.exp * 1000 > ahora;
        if (!ok) return { valido: false };
        return payload.rol !== undefined ? { valido: true, rol: payload.rol } : { valido: true };
    } catch {
        return { valido: false };
    }
}

/** Compat (CSRF booleano del callback): un state es válido si `leerState` lo ampara. */
export function verificarState(state: string, ahora: number = Date.now()): boolean {
    return leerState(state, ahora).valido;
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

/**
 * Auth URL de Google (scope openid email profile · sin `prompt`). SPEC-597:
 * omitir `prompt=select_account` para que Google use la sesión recordada y
 * entre directo cuando ya hay consentimiento previo.
 */
export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
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
