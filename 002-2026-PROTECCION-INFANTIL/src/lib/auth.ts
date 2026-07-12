import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { AppError, ERROR_CODES } from "./errors";
import { requireEnv } from "./env";
import type { RolUsuario } from "@prisma/client";

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

const JWT_TTL = "24h";

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

export async function verifyAuth(requiredRol?: RolUsuario) {
    let token: string | undefined;
    try {
        const cookieStore = await cookies();
        token = cookieStore.get("token")?.value;
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

    if (requiredRol && user.rol !== requiredRol) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }

    return user;
}

export function requireRol(rol: RolUsuario) {
    return () => verifyAuth(rol);
}