/**
 * SPEC-339 (A-67) — El rebote que cierra la falla-abierta del camino.
 *
 * Existe para UN solo caso: el guardián del camino no pudo leer la cookie
 * `sesion_estado` (venció a los 5 minutos, o es de antes del despliegue) y no
 * puede consultar la base de datos desde Edge. En vez de dejar pasar —que
 * violaría el brief §6: "no puede saltarse ningún paso, ni escribiendo la URL
 * a mano"— el middleware rebota UNA vez acá.
 *
 * Esta ruta corre en Node: re-sella la cookie con el estado real y devuelve al
 * padre a su destino (si el camino está terminado) o a su paso pendiente.
 *
 * No puede ciclar, por dos vallas independientes:
 *  1. Es ruta de sesión (`GUARDIAS_ACCESO.sesion`): el middleware retorna en su
 *     paso 3, antes de evaluar el guardián del camino.
 *  2. Si el re-sellado falla (secreto corto, base caída), NO se devuelve al
 *     padre a una ruta gobernada — se cierra la sesión y se termina en /login
 *     con un mensaje claro. Volver a una ruta gobernada sin cookie fresca
 *     produciría el segundo rebote que esta ruta promete no dar.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { buildSesionEstadoValue } from "@/lib/routing/sesion-estado-emitter";
import { NOMBRE_COOKIE, TTL_SEG, leerSesionEstado } from "@/lib/routing/vigencia-cookie";
import { destinoDePaso } from "@/lib/camino/pasos";
import { requireEnv } from "@/lib/env";

// SPEC-314: solo destinos internos — la defensa contra redirección abierta que
// ya usa el registro. Cualquier otra cosa cae al panel del padre.
function destinoSeguro(destino: string | null): string {
    if (!destino) return "/dashboard/padre";
    if (!destino.startsWith("/") || destino.startsWith("//")) return "/dashboard/padre";
    return destino;
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const destino = destinoSeguro(url.searchParams.get("destino"));

    try {
        const usuario = await verifyAuth();

        const value = await buildSesionEstadoValue(usuario.id);

        // Releer lo que se acaba de firmar es deliberado: es la única forma de
        // conocer el paso pendiente sin duplicar la derivación aquí.
        const estado = await leerSesionEstado(value, requireEnv("JWT_SECRET", 32));
        if (!estado) {
            // Firmamos algo que no podemos leer: configuración rota, no un caso
            // de usuario. Camino infeliz: a /login, jamás un segundo rebote.
            throw new Error("cookie recién firmada ilegible");
        }

        const haciaDonde =
            usuario.rol === "PARENT" && estado.pasoCamino
                ? destinoDePaso(estado.pasoCamino)
                : destino;

        const res = NextResponse.redirect(new URL(haciaDonde, request.url));
        res.cookies.set(NOMBRE_COOKIE, value, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.COOKIE_SECURE !== "false",
            maxAge: TTL_SEG,
            path: "/",
        });
        return res;
    } catch (error) {
        // Camino infeliz (Calidad · candado B): el re-sellado falló o no hay
        // sesión válida. Terminar SIEMPRE en /login con la sesión cerrada —
        // nunca devolver a una ruta gobernada, que rebotaría de nuevo.
        if (!(error instanceof AppError)) {
            logger.error("[SESION/AL-DIA] Re-sellado fallido:", error);
        }
        const res = NextResponse.redirect(new URL("/login?mensaje=sesion", request.url));
        res.cookies.delete(NOMBRE_COOKIE);
        res.cookies.delete("token");
        res.cookies.delete("__Host-token");
        return res;
    }
}
