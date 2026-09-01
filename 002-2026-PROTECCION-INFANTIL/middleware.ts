/**
 * SPEC-287 (002-PI-187 · cierra I-25 → I-111 → I-141) — middleware.ts.
 *
 * Único punto de decisión de acceso de toda la app. Ejecuta los guardianes
 * en orden (sesión → consentimiento → cambio de password → camino → vigencia) usando
 * `GUARDIAS_ACCESO` como fuente única. Los layouts bajo `/dashboard/**` son
 * UI puros; NINGUNO puede ejecutar `redirect(...)` (ratchet 2).
 *
 * Consulta de sesión en Edge: cookie firmada `sesion_estado` (HMAC-SHA256 con
 * `JWT_SECRET`, TTL 5 min) escrita por `POST /api/vigencia/refresh` (Node
 * runtime, corre Prisma). Cero I/O adicional en Edge cuando la cookie es
 * válida; refresh asincrónico cuando falta o expira.
 *
 * Al final, aplica CSP con nonce por request SOLO a `/dashboard/**` (E-6 P4c,
 * fusionado desde el antiguo `src/proxy.ts` que Next 15 no autodetectaba y
 * quedaba inerte en runtime).
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import {
    GUARDIAS_ACCESO,
    esRutaPublica,
    esRutaSesion,
    esExentaConsentimiento,
    esExentaCambiarPassword,
    esExentaCamino,
    esExentaVigencia,
    tieneVigencia,
    destinoVigencia,
} from "@/lib/routing/guardias";
import {
    NOMBRE_COOKIE as NOMBRE_COOKIE_SESION,
    leerSesionEstado,
} from "@/lib/routing/vigencia-cookie";
import { destinoDePaso } from "@/lib/camino/pasos";
import { GUARDIAS_ACCESO as G } from "@/lib/routing/guardias";

// ────────────────────────────────────────────────────────────────────────────
// Config del middleware Next 15 (raíz)
// ────────────────────────────────────────────────────────────────────────────
export const config = {
    matcher: [
        // Todas las rutas menos assets estáticos y las convenciones de Next.
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ],
};

const NOMBRE_COOKIE_SESION_LEGACY = "token";
const NOMBRE_COOKIE_SESION_HOST = "__Host-token";

// ────────────────────────────────────────────────────────────────────────────
// Utilidades
// ────────────────────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        // Fail-open sería peor que fail-closed: dejamos que el request cargue,
        // pero el layout de destino no encontrará usuario y se comportará como
        // sin sesión. Es coherente con lo que hoy hace verifyToken() → null.
        throw new Error("[middleware] JWT_SECRET ausente o menor a 32 chars");
    }
    return new TextEncoder().encode(secret);
}

async function verificarJwt(token: string | undefined): Promise<{ sub: string; rol: string } | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
        if (typeof payload.sub === "string" && typeof payload.rol === "string") {
            return { sub: payload.sub, rol: payload.rol };
        }
        return null;
    } catch {
        return null;
    }
}

function redirect(request: NextRequest, destino: string): NextResponse {
    return NextResponse.redirect(new URL(destino, request.url));
}

function redirectAtLogin(request: NextRequest): NextResponse {
    const res = redirect(request, "/login");
    res.cookies.delete(NOMBRE_COOKIE_SESION_LEGACY);
    res.cookies.delete(NOMBRE_COOKIE_SESION_HOST);
    res.cookies.delete(NOMBRE_COOKIE_SESION);
    return res;
}

// ────────────────────────────────────────────────────────────────────────────
// CSP con nonce (fusionado desde src/proxy.ts eliminado por SPEC-287)
// ────────────────────────────────────────────────────────────────────────────

const CSP_DIRECTIVAS_COMUNES = [
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self'",
];

function generarNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

function buildCsp(nonce: string, esProduccion: boolean): string {
    const scriptSrc = esProduccion
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const directivas = ["default-src 'self'", scriptSrc, ...CSP_DIRECTIVAS_COMUNES];
    if (process.env.ENABLE_HTTPS_HEADERS === "true") {
        directivas.push("upgrade-insecure-requests");
    }
    return directivas.join("; ");
}

/**
 * Aplica CSP con nonce SOLO al área privada `/dashboard/**`. Devuelve la
 * respuesta final. Para redirects y errores JSON, se agrega el header al
 * existente. Para `next()`, se reconstruye con request headers extendidos.
 */
function aplicarCspSiCorresponde(request: NextRequest, response: NextResponse): NextResponse {
    const { pathname } = request.nextUrl;
    if (!pathname.startsWith("/dashboard")) return response;

    const nonce = generarNonce();
    const csp = buildCsp(nonce, process.env.NODE_ENV === "production");

    if (response.headers.get("x-middleware-next") === "1") {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-csp-nonce", nonce);
        requestHeaders.set("Content-Security-Policy", csp);
        const paso = NextResponse.next({ request: { headers: requestHeaders } });
        paso.headers.set("Content-Security-Policy", csp);
        return paso;
    }

    response.headers.set("Content-Security-Policy", csp);
    return response;
}

// ────────────────────────────────────────────────────────────────────────────
// Middleware principal — 6 pasos del brief §2.3
// ────────────────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
    const { pathname } = request.nextUrl;

    // Paso 1: rutas públicas → pasan sin token.
    if (esRutaPublica(pathname)) {
        return aplicarCspSiCorresponde(request, NextResponse.next());
    }

    // Paso 2: sesión — el JWT DEBE ser válido de aquí en adelante.
    const token =
        request.cookies.get(NOMBRE_COOKIE_SESION_HOST)?.value ??
        request.cookies.get(NOMBRE_COOKIE_SESION_LEGACY)?.value;
    const sesion = await verificarJwt(token);
    if (!sesion) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
        }
        return aplicarCspSiCorresponde(request, redirectAtLogin(request));
    }

    // Paso 3: rutas de sesión pura (no evalúan consentimiento/vigencia).
    if (esRutaSesion(pathname)) {
        return aplicarCspSiCorresponde(request, NextResponse.next());
    }

    // Paso 4/5/6: leer estado firmado de la cookie. Si no está o expiró, el
    // middleware permite el paso — el layout/página vería un estado stale por
    // <5 min pero NO se cuelga la BD desde Edge. El refresh asincrónico se
    // dispara por el propio cliente al montar (vía POST /api/vigencia/refresh),
    // o desde las Server Actions que cambian estado.
    const secret = process.env.JWT_SECRET ?? "";
    const estado =
        secret.length >= 16
            ? await leerSesionEstado(request.cookies.get(NOMBRE_COOKIE_SESION)?.value, secret)
            : null;

    if (estado) {
        // Paso 4: consentimiento.
        if (estado.requiereConsentimiento && !esExentaConsentimiento(pathname)) {
            // SPEC-329 (002-PI-229): las /api/** gateadas responden JSON 403 (no 302 HTML),
            // igual que el Paso 2 con su 401 — un fetch NO puede seguir un redirect y
            // confundir el bloqueo con éxito. Las pantallas (no-api) siguen redirigiendo.
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: { message: "Debes aceptar el consentimiento para continuar.", code: "CONSENTIMIENTO_REQUERIDO", redirectTo: GUARDIAS_ACCESO.consentimiento.destino } },
                    { status: 403 }
                );
            }
            return aplicarCspSiCorresponde(request, redirect(request, GUARDIAS_ACCESO.consentimiento.destino));
        }
        // Paso 5: cambio-de-password obligatorio.
        if (estado.debeCambiarPassword && !esExentaCambiarPassword(pathname)) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { error: { message: "Debes cambiar tu contraseña para continuar.", code: "CAMBIO_PASSWORD_REQUERIDO", redirectTo: GUARDIAS_ACCESO.cambiarPassword.destino } },
                    { status: 403 }
                );
            }
            return aplicarCspSiCorresponde(request, redirect(request, GUARDIAS_ACCESO.cambiarPassword.destino));
        }
        // Paso 5 (SPEC-339 · A-67): el camino guiado del padre.
        //
        // Solo el padre lo recorre. El Paso 1 no tiene pantalla propia: reusa
        // `/consentimiento`, que ya existe y está bien hecha; por eso el destino
        // del paso "permiso" apunta allí y no a una pantalla nueva.
        if (sesion.rol === "PARENT" && estado.pasoCamino && !esExentaCamino(pathname)) {
            const destino = destinoDePaso(estado.pasoCamino);
            if (pathname.startsWith("/api/")) {
                // SPEC-329: las /api/** gateadas responden JSON 403, no 302 —
                // un fetch no puede seguir un redirect y confundiría el bloqueo
                // con un éxito.
                return NextResponse.json(
                    {
                        error: {
                            message: "Termina de configurar tu cuenta para continuar.",
                            code: "CAMINO_INCOMPLETO",
                            redirectTo: destino,
                        },
                    },
                    { status: 403 }
                );
            }
            return aplicarCspSiCorresponde(request, redirect(request, destino));
        }
        // Paso 6: vigencia por rol.
        if (tieneVigencia(sesion.rol)) {
            if (!esExentaVigencia(pathname, sesion.rol)) {
                if (estado.vigencia !== "ACTIVA" && estado.vigencia !== "EN_GRACIA") {
                    const destino = destinoVigencia(sesion.rol);
                    if (pathname.startsWith("/api/")) {
                        return NextResponse.json(
                            { error: { message: "Tu servicio no está vigente. Renueva para continuar.", code: "VIGENCIA_REQUERIDA", redirectTo: destino } },
                            { status: 403 }
                        );
                    }
                    return aplicarCspSiCorresponde(request, redirect(request, destino));
                }
            }
        }
    }

    // SPEC-339 (A-67) — LA GRIETA DE LA FALLA-ABIERTA.
    //
    // Cuando la cookie de estado no se puede leer (venció a los 5 min, o es de
    // antes de este despliegue), el bloque de arriba entero se salta y el
    // middleware DEJA PASAR. Para vigencia esa ventana se tolera a propósito
    // (no colgar la BD desde Edge). Para el camino NO: el brief §6 exige que el
    // padre no pueda saltarse un paso "ni escribiendo la URL a mano", y con
    // falla-abierta bastaba con esperar cinco minutos.
    //
    // Solución sin tocar la BD desde Edge: un rebote ÚNICO a una ruta de sesión
    // (Node) que re-sella la cookie y devuelve al padre a su destino o a su paso.
    // No puede ciclar: `/api/sesion/al-dia` es ruta de sesión, así que el
    // middleware retorna antes de llegar a este punto cuando la pide.
    if (!estado && sesion.rol === "PARENT" && !esExentaCamino(pathname) && !pathname.startsWith("/api/")) {
        const alDia = new URL(G.caminoRebote, request.url);
        alDia.searchParams.set("destino", pathname);
        return aplicarCspSiCorresponde(request, NextResponse.redirect(alDia));
    }

    return aplicarCspSiCorresponde(request, NextResponse.next());
}
