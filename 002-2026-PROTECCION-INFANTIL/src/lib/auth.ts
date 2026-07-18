import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { AppError, ERROR_CODES } from "./errors";
import { requireEnv } from "./env";
import type { RolUsuario } from "@prisma/client";

const LEGACY_COOKIE_NAME = "token";
const HOST_COOKIE_NAME = "__Host-token";

export function getCookieName(secure: boolean): string {
    return secure ? HOST_COOKIE_NAME : LEGACY_COOKIE_NAME;
}

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

const JWT_TTL = "24h";

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
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(JWT_TTL)
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
    });

    if (!user || user.estado !== "activo") {
        throw new AppError("Usuario no activo", ERROR_CODES.AUTH_INVALID, 401);
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
    return () => verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
}

export function requireOperadorOAdmin() {
    return () => verifyAuth(["ADMIN", "SCHOOL_ADMIN", "OPERADOR"]);
}

export function requireComiteOAdmin() {
    return () => verifyAuth(["ADMIN", "SCHOOL_ADMIN", "COMITE_VALIDACION"]);
}

export function requireAdminOComiteOOperador() {
    return () => verifyAuth(["ADMIN", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION"]);
}

export async function setSessionCookie(request: Request, token: string): Promise<void> {
    const secure = isSecureRequest(request);
    const cookieStore = await cookies();
    cookieStore.set(getCookieName(secure), token, {
        httpOnly: true,
        secure,
        sameSite: secure ? "strict" : "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
    });
}