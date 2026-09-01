import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Sesión propia del 006 — helper CENTRAL (SE1: nadie escribe la cookie
 * inline en ningún endpoint; todo pasa por aquí). Cookie httpOnly firmada
 * con BI_AUTH_SECRET (propio del 006; jamás compartido con PI).
 */
export const COOKIE_SESION = "bi_sesion";
const DURACION_SEG = 60 * 60 * 12; // 12 h

function clave(): Uint8Array {
    const secreto = process.env.BI_AUTH_SECRET;
    if (!secreto) throw new Error("BI_AUTH_SECRET no configurado");
    return new TextEncoder().encode(secreto);
}

export async function emitirSesion(email: string): Promise<void> {
    const token = await new SignJWT({ sub: email, rol: "ADMIN_BI" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${DURACION_SEG}s`)
        .sign(clave());
    const jar = await cookies();
    jar.set(COOKIE_SESION, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: DURACION_SEG,
    });
}

export async function cerrarSesion(): Promise<void> {
    const jar = await cookies();
    jar.delete(COOKIE_SESION);
}

/** SE2: ante cualquier error devuelve null (fail-closed). */
export async function leerSesion(): Promise<{ email: string } | null> {
    const jar = await cookies();
    const token = jar.get(COOKIE_SESION)?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, clave());
        return typeof payload.sub === "string" ? { email: payload.sub } : null;
    } catch {
        return null;
    }
}
