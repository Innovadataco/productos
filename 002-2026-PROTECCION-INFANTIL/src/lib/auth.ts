import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { AppError, ERROR_CODES } from "./errors";
import { requireEnv } from "./env";
import type { Prisma, RolUsuario } from "@prisma/client";
import { getParametroSistema } from "./parametros";
import { SessionLogService } from "./dal/services/session-log";
import { sessionCookieAttributes } from "./auth/session-cookie-attrs";

const LEGACY_COOKIE_NAME = "token";
const HOST_COOKIE_NAME = "__Host-token";

export function getCookieName(secure: boolean): string {
    return secure ? HOST_COOKIE_NAME : LEGACY_COOKIE_NAME;
}

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

// Spec 095-US2 (D-21): el TTL del JWT es un parámetro (security.jwt_ttl_hours), no un literal.
// Fallback seguro: 24h si el parámetro no existe o es inválido.
const JWT_TTL_FALLBACK_HOURS = 24;

// SPEC-672 (I-399): el camino de autenticación NO lee el Usuario entero. Sin `select`,
// Prisma nombra TODOS los escalares; un DROP de columna tumba `verifyAuth` (que gatea
// /api/reportes) y, peor, el P2022 lo traga el catch → 403 «sesión no válida» (un
// error de esquema disfrazado de expiración). El conjunto de campos sale de los
// CONSUMIDORES del objeto devuelto —verificado por el type-checker—, no de lo que
// estas funciones usan directamente. El candado vigila la FORMA (nunca sin select).
const USUARIO_AUTH_SELECT = {
    id: true,
    estado: true,
    rol: true,
    email: true,
    nombre: true,
    colegioId: true,
    comiteColegioId: true,
    tenantId: true,
    // cambiar-password verifica el hash actual del propio usuario autenticado.
    passwordHash: true,
    // /api/me informa si el usuario debe cambiar la contraseña.
    debeCambiarPassword: true,
    // anti-abuso: la antigüedad de la cuenta del reportante autenticado pondera la
    // señal de fuente (crearFuenteReporte → calcularDiasAntiguedad). Sin esto, esa
    // ponderación se degrada en silencio para usuarios logueados.
    creadoEn: true,
} satisfies Prisma.UsuarioSelect;

/** Forma del usuario que devuelve el camino de autenticación (solo lo que se consume). */
export type UsuarioAutenticado = Prisma.UsuarioGetPayload<{ select: typeof USUARIO_AUTH_SELECT }>;

async function obtenerJwtTtlSegundos(): Promise<number> {
    const param = await getParametroSistema("security.jwt_ttl_hours");
    const horas = param ? parseInt(param.valor, 10) : NaN;
    return (Number.isFinite(horas) && horas > 0 ? horas : JWT_TTL_FALLBACK_HOURS) * 3600;
}

export function isSecureRequest(request: Request): boolean {
    // Permite forzar el comportamiento desde variables de entorno.
    // En redes locales HTTP (ej: 192.168.x.x) usar COOKIE_SECURE=false
    if (process.env.COOKIE_SECURE) {
        return process.env.COOKIE_SECURE === "true";
    }

    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedProto) {
        return forwardedProto === "https";
    }
    try {
        return new URL(request.url).protocol === "https:";
    } catch {
        return false;
    }
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export async function createToken(payload: Record<string, unknown>): Promise<string> {
    // SPEC-554: `iat` y `exp` derivan de UN SOLO instante. Antes `setIssuedAt()` y
    // `setExpirationTime("Xh")` leían el reloj por separado; si un segundo cruzaba
    // entre ambas lecturas, `exp - iat` daba `ttl ± 1` (p. ej. 86401 vs 86400) — un
    // falso rojo del reloj de pared. Con un `iat` fijo el TTL es EXACTO siempre, en
    // producción y en test, sin depender de congelar el reloj.
    const ttlSegundos = await obtenerJwtTtlSegundos();
    const iat = Math.floor(Date.now() / 1000);
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(iat)
        .setExpirationTime(iat + ttlSegundos)
        .sign(getSecret());
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, getSecret(), {
            clockTolerance: 60,
        });
        return payload;
    } catch {
        return null;
    }
}

export async function getUserFromToken(request: Request) {
    try {
        const cookieHeader = request.headers.get("cookie");
        if (!cookieHeader) return null;
        const match = cookieHeader.match(/(?:__Host-)?token=([^;]+)/);
        if (!match) return null;
        const token = match[1];
        const payload = await verifyToken(token);
        if (!payload || !payload.sub) return null;
        const user = await prisma.usuario.findUnique({
            where: { id: payload.sub as string },
            select: USUARIO_AUTH_SELECT,
        });
        if (!user || user.estado !== "activo") return null;
        return user;
    } catch {
        return null;
    }
}

/**
 * SPEC-603 (hotfix): resuelve el usuario de sesión para Server Components
 * (layouts/páginas que no reciben `Request`, a diferencia de `getUserFromToken`).
 *
 * Un JWT con firma válida cuyo `sub` ya no existe en BD (usuario purgado) es una
 * SESIÓN HUÉRFANA y se trata como NO autenticada: devuelve null, igual que si no
 * hubiera token. Nunca propagar ese `sub` a consultas ni auditorías: las
 * escrituras con FK a Usuario (p. ej. AuditLog) explotan con P2003 y tumban el
 * render de páginas públicas (visto en producción en GET /reportar).
 *
 * La cookie huérfana no puede borrarse desde un Server Component; la expira la
 * respuesta 401 de /api/me (route handler), que el cliente consulta siempre.
 */
export async function getSessionUser() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(HOST_COOKIE_NAME)?.value ?? cookieStore.get(LEGACY_COOKIE_NAME)?.value;
        if (!token) return null;
        const payload = await verifyToken(token);
        if (!payload || !payload.sub) return null;
        const user = await prisma.usuario.findUnique({
            where: { id: payload.sub as string },
            select: USUARIO_AUTH_SELECT,
        });
        if (!user || user.estado !== "activo") return null;
        return user;
    } catch {
        return null;
    }
}

export async function verifyAuth(requiredRol?: RolUsuario | RolUsuario[]) {
    let token: string | undefined;
    try {
        const cookieStore = await cookies();
        token = cookieStore.get(HOST_COOKIE_NAME)?.value ?? cookieStore.get(LEGACY_COOKIE_NAME)?.value;
    } catch {
        token = undefined;
    }
    if (!token) {
        throw new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401);
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
        throw new AppError("Token inválido o expirado", ERROR_CODES.AUTH_EXPIRED, 401);
    }

    const user = await prisma.usuario.findUnique({
        where: { id: payload.sub as string },
        select: USUARIO_AUTH_SELECT,
    });

    if (!user || user.estado !== "activo") {
        throw new AppError("Usuario no activo", ERROR_CODES.AUTH_INVALID, 401);
    }

    // SPEC-206 (002-PI-120): si el JWT trae sesionLogId, la sesión debe seguir abierta.
    // Tokens previos sin el campo siguen funcionando (retrocompatibilidad).
    const sesionLogId = payload.sesionLogId;
    if (typeof sesionLogId === "string") {
        const sesionActiva = await new SessionLogService().estaSesionActiva(sesionLogId);
        if (!sesionActiva) {
            throw new AppError("Sesión cerrada", ERROR_CODES.AUTH_EXPIRED, 401);
        }
    }

    if (requiredRol) {
        const roles = Array.isArray(requiredRol) ? requiredRol : [requiredRol];
        if (!roles.includes(user.rol)) {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }
    }

    return user;
}

export function requireRol(rol: RolUsuario | RolUsuario[]) {
    return () => verifyAuth(rol);
}

export function requireAdmin() {
    return () => verifyAuth("ADMIN");
}

export function requireOperadorOAdmin() {
    return () => verifyAuth(["ADMIN", "OPERADOR"]);
}

export function requireComiteOAdmin() {
    return () => verifyAuth(["ADMIN", "COMITE_VALIDACION"]);
}

export function requireAdminOComiteOOperador() {
    return () => verifyAuth(["ADMIN", "OPERADOR", "COMITE_VALIDACION"]);
}

export function requireSchoolAdmin() {
    return () => verifyAuth("SCHOOL_ADMIN");
}

// Spec 106: `sessionCookieAttributes` es la fuente única de los atributos de la cookie de sesión
// (SameSite=Strict en prod, D-131). Se extrajo a `./auth/session-cookie-attrs` (sin Prisma ni env
// pesado) para poder probarla en aislamiento; se re-exporta acá para no tocar a sus llamadores.
export { sessionCookieAttributes };

export async function setSessionCookie(request: Request, token: string): Promise<void> {
    const secure = isSecureRequest(request);
    const cookieStore = await cookies();
    cookieStore.set(getCookieName(secure), token, {
        ...sessionCookieAttributes(secure),
        maxAge: 60 * 60 * 24,
    });
}