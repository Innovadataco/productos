/**
 * SPEC-287 (002-PI-187) — POST /api/vigencia/refresh.
 *
 * Refresca la cookie firmada `sesion_estado` con los 3 flags que el middleware
 * necesita para decidir sin tocar Prisma en Edge:
 *   - vigencia efectiva de la suscripción
 *   - si el usuario debe firmar consentimiento (SPEC-241)
 *   - si el usuario debe cambiar contraseña
 *
 * Corre en Node runtime (default) — puede llamar a Prisma. Se protege con el
 * mismo JWT que el resto de las rutas de sesión.
 *
 * Consumidores:
 *   - El cliente al montar el layout autenticado (fetch inicial).
 *   - Server Actions que cambian el estado (activar freemium, renovación,
 *     cancelación, aceptar consentimiento, cambiar password) — las que
 *     existan hoy o se agreguen en el futuro.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";

export const runtime = "nodejs";

export async function POST() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) {
        return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.sub) {
        return NextResponse.json({ error: { message: "Token inválido" } }, { status: 401 });
    }

    const userId = payload.sub as string;
    const cookieValue = await buildSesionEstadoValue(userId);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(NOMBRE_COOKIE, cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE !== "false",
        maxAge: TTL_SEG,
        path: "/",
    });
    return res;
}
