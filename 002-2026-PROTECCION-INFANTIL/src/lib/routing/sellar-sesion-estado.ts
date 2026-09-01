import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
 * Fallo suave: la cookie de estado no debe bloquear la acción principal (la
 * suscripción ya quedó creada); en el peor caso el gate se abre en el próximo
 * `session/ping` o `vigencia/refresh`, como antes.
 *
 * SPEC-339 (T079): devuelve si selló de verdad. Los llamadores del camino usan
 * el `false` para avisarle al padre que el avance puede tardar en reflejarse —
 * tragarse el fallo dejaba al padre repitiendo el paso "en silencio". Los
 * llamadores anteriores ignoran el retorno y conservan su comportamiento.
 */
export async function sellarCookieSesionEstado(res: NextResponse, userId: string): Promise<boolean> {
    try {
        const value = await buildSesionEstadoValue(userId);
        res.cookies.set(NOMBRE_COOKIE, value, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.COOKIE_SECURE !== "false",
            maxAge: TTL_SEG,
            path: "/",
        });
        return true;
    } catch {
        // la cookie de estado no bloquea la acción principal
        return false;
    }
}

/**
 * SPEC-342 (hotfix I-227 re-confirmada) · variante para SERVER ACTIONS.
 *
 * La causa raíz del padre atrapado en /camino/listo: la RUTA
 * /api/padre/suscripcion/activar-freemium sí re-sella (SPEC-335), pero las
 * pantallas del plan (/camino/plan y /dashboard/padre/suscripcion) activan por
 * SERVER ACTION → `activarFreemiumConRateLimit` directo, sin pasar por la ruta.
 * El sellado de la ruta era la valla equivocada para este flujo (candado 26:
 * el síntoma no es la causa). En vigencia nunca se notó porque su guardián
 * falla ABIERTO con cookie vieja; el del camino falla CERRADO — 5 min preso.
 *
 * Mismo contrato que la variante de NextResponse: true = selló.
 */
export async function sellarCookieSesionEstadoEnAccion(userId: string): Promise<boolean> {
    try {
        const value = await buildSesionEstadoValue(userId);
        const store = await cookies();
        store.set(NOMBRE_COOKIE, value, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.COOKIE_SECURE !== "false",
            maxAge: TTL_SEG,
            path: "/",
        });
        return true;
    } catch {
        return false;
    }
}
