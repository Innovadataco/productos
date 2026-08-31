import { NextResponse } from "next/server";
import { buildSesionEstadoValue } from "./sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG } from "./vigencia-cookie";

/**
 * SPEC-335 (I-227) · Re-sella la cookie firmada `sesion_estado` en la respuesta
 * para `userId`, con las mismas opciones que login/consentimiento/vigencia-refresh.
 *
 * Se llama en TODO endpoint donde el usuario autenticado cambia su PROPIA vigencia
 * (p. ej. activar freemium): así el middleware abre los gates AL INSTANTE, sin
 * esperar un refresh que re-selle la cookie. Es el arreglo de la clase de bugs de
 * cookie stale (I-211 / I-222 / I-224 / I-227): centralizar el patrón para que el
 * próximo endpoint no lo olvide.
 *
 * Fallo silencioso: la cookie de estado no debe bloquear la acción principal (la
 * suscripción ya quedó creada); en el peor caso el gate se abre en el próximo
 * `session/ping` o `vigencia/refresh`, como antes.
 */
export async function sellarCookieSesionEstado(res: NextResponse, userId: string): Promise<void> {
    try {
        const value = await buildSesionEstadoValue(userId);
        res.cookies.set(NOMBRE_COOKIE, value, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.COOKIE_SECURE !== "false",
            maxAge: TTL_SEG,
            path: "/",
        });
    } catch {
        // la cookie de estado no bloquea la acción principal
    }
}
