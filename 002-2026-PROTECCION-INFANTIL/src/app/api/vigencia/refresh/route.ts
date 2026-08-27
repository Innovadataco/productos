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
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import { resolverEstadoVigencia } from "@/lib/pagos/vigencia-middleware";
import { firmarSesionEstado, NOMBRE_COOKIE, TTL_SEG } from "@/lib/routing/vigencia-cookie";
import { requireEnv } from "@/lib/env";

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

    // Consulta paralela — cada capa vive en su repo (Q-3 DAL frontier).
    const [suscripcion, requiereConsentimiento, usuario] = await Promise.all([
        new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(userId),
        requiereConsentimientoActual(userId),
        new UsuarioRepository().findDebeCambiarPassword(userId),
    ]);

    const vigencia = resolverEstadoVigencia(suscripcion);
    const debeCambiarPassword = Boolean(usuario?.debeCambiarPassword);

    const cookieValue = await firmarSesionEstado(
        { vigencia, requiereConsentimiento, debeCambiarPassword },
        requireEnv("JWT_SECRET", 32),
    );

    const res = NextResponse.json({ ok: true, vigencia, requiereConsentimiento, debeCambiarPassword });
    res.cookies.set(NOMBRE_COOKIE, cookieValue, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE !== "false",
        maxAge: TTL_SEG,
        path: "/",
    });
    return res;
}
