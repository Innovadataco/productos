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
import { GUARDIAS_ACCESO } from "@/lib/routing/guardias";

// SPEC-397 (I-237 · seguridad · open redirect vivo en prod): defensa por CLASE,
// no por lista de cadenas. Historia:
//  · SPEC-339 abrió la superficie.
//  · SPEC-342 (BUG3) cerró la barra invertida (`/\\evil.com`) chequeando que el
//    origin resuelto no cambie contra la base.
//  · I-237 encontró la clase que sobrevivía: entradas como "/..//evil.example.com"
//    saturan el chequeo de origin (origin sigue siendo el nuestro) porque el
//    pathname resuelto queda `//evil.example.com`. `pathname + search` se
//    devolvía como string; la llamada `new URL(haciaDonde, base)` de más abajo
//    lo reinterpretaba y `//host` es URL relativa al protocolo → escape.
//
// El arreglo cierra dos huecos a la vez:
//  1. Se devuelve el URL ABSOLUTO ya resuelto (no un string relativo) — el
//     redirect no vuelve a parsear y la clase entera de "protocol-relative
//     smuggling" muere ahí.
//  2. Como cinturón, se rechaza cualquier pathname que empiece con `//`
//     (defensa en profundidad — si mañana algún callsite volviera a serializar
//     el pathname y a reparsear, el candado igual dispara).
function destinoSeguro(destino: string | null, base: string): URL {
    const fallback = new URL("/dashboard/padre", base);
    if (!destino || !destino.startsWith("/")) return fallback;
    try {
        const resuelta = new URL(destino, base);
        if (resuelta.origin !== new URL(base).origin) return fallback;
        // Cinturón anti-protocol-relative: tras normalizar, el pathname NO
        // puede empezar con "//" — reparsear eso como URL relativa cambia el
        // origin (I-237). No debería llegar acá si el chequeo de origin cerró
        // el caso, pero cierra la clase contra reintroducciones futuras.
        if (resuelta.pathname.startsWith("//")) return fallback;
        return resuelta;
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
        // siempre reciben `null` y caen al `destino` solicitado. El registry
        // devuelve rutas literales del código (nunca user input) así que se
        // pueden resolver directamente contra la base.
        const destinoPaso = destinoParaRol(usuario.rol, estado.pasoCamino);
        const haciaDonde = destinoPaso ? new URL(destinoPaso, base) : destino;

        // SPEC-572 (I-236 · loop-cap): marcamos el destino con `marcaRebote` — "ya
        // rebotaste una vez y re-sellé". Si la cookie que fijamos abajo NO pega en el
        // cliente (rechazada, reloj adelantado, secure sobre http), el destino vuelve al
        // middleware SIN estado pero CON la marca, y ese la usa para cortar el bucle
        // (aterriza en /login) en vez de rebotar de nuevo acá. Se fija sobre el URL ya
        // resuelto (SPEC-397): `searchParams` solo toca la query, nunca el pathname, así
        // que la defensa anti-open-redirect de `destinoSeguro` queda intacta.
        haciaDonde.searchParams.set(GUARDIAS_ACCESO.marcaRebote, "1");

        // SPEC-342 (candado 22v3): JAMÁS request.url como base de un redirect en
        // Docker — sale 0.0.0.0 y el navegador muere. Base pública de 3 niveles.
        // SPEC-397: el URL absoluto entra tal cual — no se reparsea ni se serializa
        // como string por el camino, para que ninguna capa lo reinterprete.
        const res = NextResponse.redirect(haciaDonde);
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
