import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireEnv, envBool } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";

const COOKIE_NAME = "token";
const JWT_TTL = "24h";
const BCRYPT_COST = 12;

function getSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

export interface SessionPayload {
  sub: number; // usn_id
  rol: number; // usn_rol_id (1|2|3)
  nit: string; // identificación efectiva del vigilado (heredada si rol 3)
  [key: string]: unknown;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export async function createToken(payload: SessionPayload): Promise<string> {
  // `sub` es una claim reservada de tipo string en JWT: se firma como string y se reconstruye a number.
  return new SignJWT({ rol: payload.rol, nit: payload.nit })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
    if (!payload.sub) return null;
    return {
      sub: Number(payload.sub),
      rol: Number(payload.rol),
      nit: String(payload.nit ?? ""),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const secure = envBool("COOKIE_SECURE", false);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "strict" : "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" });
}

/// Lee el payload de la sesión desde la cookie (sin tocar BD).
export async function getSessionPayload(): Promise<SessionPayload | null> {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  } catch {
    token = undefined;
  }
  if (!token) return null;
  return verifyToken(token);
}

/// Verifica la sesión y (opcional) el rol. Devuelve el usuario activo o lanza AppError.
export async function verifyAuth(rolesPermitidos?: number | number[]) {
  const payload = await getSessionPayload();
  if (!payload || !payload.sub) {
    throw new AppError("No autenticado", ERROR_CODES.AUTH_EXPIRED, 401);
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: Number(payload.sub) } });
  if (!usuario || usuario.estado !== true) {
    throw new AppError("Usuario no activo", ERROR_CODES.AUTH_INVALID, 401);
  }
  if (rolesPermitidos !== undefined) {
    const roles = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    if (!usuario.rolId || !roles.includes(usuario.rolId)) {
      throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
  }
  return usuario;
}

/// Política de contraseña (regex confirmada del legacy): ≥8, minús, mayús, dígito, especial.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

export function validarPassword(clave: string): boolean {
  return PASSWORD_REGEX.test(clave);
}
