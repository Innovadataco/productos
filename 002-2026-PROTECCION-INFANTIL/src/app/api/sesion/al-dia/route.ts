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
import { destinoParaRol } from "@/lib/camino/pasos";
import { requireEnv } from "@/lib/env";
import { baseUrlPublica } from "@/lib/routing/base-url-publica";

// SPEC-342 (BUG3 · seguridad): defensa contra redirección abierta POR URL, no
// por parcheo de strings. El chequeo de prefijos ("//") dejaba pasar la barra
// invertida: los navegadores normalizan "\\" como "/", así que "/\\evil.com"
// terminaba en Location: https://evil.com/ (reproducido en vivo por Calidad).
// La única autoridad válida es el ORIGIN resultante de resolver el destino
// contra nuestra base: si cambió, el destino intentaba escaparse.
function destinoSeguro(destino: string | null, base: string): string {
    const fallback = "/dashboard/padre";
    if (!destino || !destino.startsWith("/")) return fallback;
    try {
        const resuelta = new URL(destino, base);
        if (resuelta.origin !== new URL(base).origin) return fallback;
        return resuelta.pathname + resuelta.search;
    } catch {
        return fallback;
    }
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const base = baseUrlPublica(request);
    const destino = destinoSeguro(url.searchParams.get("destino"), base);

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

        // SPEC-344 (A-69 · C1): padre Y rector comparten la misma cadena. El
        // registry `destinoParaRol` despacha por rol; roles sin camino guiado
        // siempre reciben `null` y caen al `destino` solicitado.
        const destinoPaso = destinoParaRol(usuario.rol, estado.pasoCamino);
        const haciaDonde = destinoPaso ?? destino;

        // SPEC-342 (candado 22v3): JAMÁS request.url como base de un redirect en
        // Docker — sale 0.0.0.0 y el navegador muere. Base pública de 3 niveles.
        const res = NextResponse.redirect(new URL(haciaDonde, base));
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
        const res = NextResponse.redirect(new URL("/login?mensaje=sesion", base));
        // BUG4: sin Path=/ el delete no borra cookies fijadas con path "/" — el
        // fallback a /login no cerraba sesión de verdad.
        res.cookies.delete({ name: NOMBRE_COOKIE, path: "/" });
        res.cookies.delete({ name: "token", path: "/" });
        res.cookies.delete({ name: "__Host-token", path: "/" });
        return res;
    }
}
