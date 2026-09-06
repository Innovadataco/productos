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
import { esTitularDelDato, tieneCaminoGuiado } from "@/lib/routing/roles-titulares";
import { destinoDePaso, destinoParaRol } from "@/lib/camino/pasos";
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

function redirectAtLogin(request: NextRequest, mensaje?: string): NextResponse {
    // `mensaje` (opcional) pinta el aviso en /login — p.ej. "sesion" cuando el
    // loop-cap (SPEC-572) corta un rebote perpetuo: el usuario aterriza en algo
    // que le habla, no en un callejón silencioso.
    const res = redirect(request, mensaje ? `/login?mensaje=${encodeURIComponent(mensaje)}` : "/login");
    // SPEC-342 (BUG4): sin Path=/ estos delete no borran cookies fijadas con
    // path "/" — la sesión "cerrada" seguía viva.
    res.cookies.delete({ name: NOMBRE_COOKIE_SESION_LEGACY, path: "/" });
    res.cookies.delete({ name: NOMBRE_COOKIE_SESION_HOST, path: "/" });
    res.cookies.delete({ name: NOMBRE_COOKIE_SESION, path: "/" });
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
    // SPEC-531: comparación por SEGMENTO, no por prefijo. `startsWith("/dashboard")`
    // barría la pública PRERENDERIZADA `/dashboard-publico` al CSP con nonce del área
    // privada; como su HTML se hornea sin nonce, con `strict-dynamic` el navegador
    // bloqueaba TODOS sus scripts. El endurecimiento es SOLO del área privada `/dashboard/**`.
    if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) return response;

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
        // Paso 4: consentimiento. SPEC-416 (I-118 · orden CEO 03-09-2026):
        // el guard se le pide SOLO a titulares del dato — fuente única de
        // la regla legal en `roles-titulares.ts` (motivo probatorio explicado
        // ahí). Cualquier rol nuevo declara su condición ahí y este bloque
        // se entera sin cambios.
        if (esTitularDelDato(sesion.rol) && estado.requiereConsentimiento && !esExentaConsentimiento(pathname)) {
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
        // Paso 5 (SPEC-339 · A-67 + SPEC-344 · A-69 · C1): el camino guiado.
        //
        // Padre (PARENT) y rector (SCHOOL_ADMIN) comparten la misma cadena. El
        // destino se despacha por rol vía `destinoParaRol`. Otros roles nunca
        // llevan `pasoCamino` en la cookie (emisor lo garantiza), así que no
        // llegan a esta rama. NO reusar `esTitularDelDato`: son criterios
        // distintos que HOY coinciden en los mismos roles — pueden divergir
        // cuando aparezca un titular sin onboarding guiado (o al revés).
        // Fuente única en `roles-titulares.ts` (dos constantes distintas).
        if (
            tieneCaminoGuiado(sesion.rol) &&
            estado.pasoCamino &&
            !esExentaCamino(pathname, sesion.rol)
        ) {
            const destino = destinoParaRol(sesion.rol, estado.pasoCamino);
            if (!destino) {
                // Cookie corrupta o rol/paso incompatible: dejamos pasar y el
                // próximo `/api/sesion/al-dia` re-sella. No es un bloqueo duro.
                // Continúa al Paso 6 (vigencia).
            } else {
                if (pathname.startsWith("/api/")) {
                // SPEC-329: las /api/** gateadas responden JSON 403, no 302 —
                // un fetch no puede seguir un redirect y confundiría el bloqueo
                // con un éxito.
                    return NextResponse.json(
                        {
                            error: {
                                // Voz por rol: al rector se le habla de usted (Colombia).
                                message:
                                    sesion.rol === "SCHOOL_ADMIN"
                                        ? "Termine de configurar su cuenta para continuar."
                                        : "Termina de configurar tu cuenta para continuar.",
                                code: "CAMINO_INCOMPLETO",
                                redirectTo: destino,
                            },
                        },
                        { status: 403 }
                    );
                }
                return aplicarCspSiCorresponde(request, redirect(request, destino));
            }
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

    // SPEC-572 (I-236) — FALLA-CERRADA del estado de sesión (cierra la grieta de I-236).
    //
    // El JWT es válido (Paso 2), pero la cookie firmada `sesion_estado` está AUSENTE o EXPIRÓ:
    // no sabemos consentimiento/cambio-de-password/camino/vigencia. La condición que encendía los
    // tres muros era la PRESENCIA de una cookie que el CLIENTE controla — borrarla (o dejarla
    // vencer) los apagaba, indefinidamente, con la sesión igual de autenticada por su JWT.
    // SPEC-339 solo había cerrado el CAMINO (y solo en páginas); consentimiento, cambio de
    // password, vigencia y TODO /api/** seguían fallando ABIERTO.
    //
    // Regla dura (CEO): ausente/expirado = DESCONOCIDO, y desconocido CIERRA, no abre.
    //
    // No se puede derivar de la BD desde Edge. Cierre (SPEC-339 generalizada a todos los muros):
    // un rebote ÚNICO a `/api/sesion/al-dia` (Node) que re-deriva el estado real, re-sella la
    // cookie y devuelve al destino. NO cicla: es ruta de sesión (Paso 3 retorna antes de acá).
    // El cierre es INCONDICIONAL: llegado este punto ya pasamos Paso 1/2/3, y toda ruta que llega
    // acá está sujeta al menos al muro de cambio-de-password (sus exentas son rutas de sesión que
    // ya retornaron). Con estado presente, los muros de arriba deciden; sin estado, se re-deriva.
    if (!estado) {
        if (pathname.startsWith("/api/")) {
            // SPEC-329: JSON 403, nunca 302 — un fetch no sigue redirects y confundiría el bloqueo
            // con éxito. Código PROPIO para que el interceptor de sesión (SPEC-400) lo distinga de
            // un 403 de muro real (esos NO se reintentan) y dispare el refresh (`/api/vigencia/refresh`)
            // + retry. Un adversario que borra la cookie y pega directo a la API recibe 403, no pasa.
            return NextResponse.json(
                {
                    error: {
                        message: "Tu sesión necesita revalidarse. Reintenta.",
                        code: "SESION_ESTADO_REQUERIDO",
                        redirectTo: G.caminoRebote,
                    },
                },
                { status: 403 },
            );
        }
        // SPEC-572 (I-236 · loop-cap, revisión CEO): si YA rebotamos una vez —el destino
        // trae `marcaRebote`— y la cookie SIGUE ausente, el re-sello de `al-dia` no pegó en
        // el cliente (cookie rechazada, reloj adelantado, `secure` sobre http). El endpoint
        // no ve ese fallo (cree que re-selló); solo esta marca sobrevive el viaje. Otro
        // rebote sería un bucle infinito de 307 que deja al usuario fuera. Cortamos a /login
        // (ruta pública, terminal, cierra la sesión) con un mensaje — algo que le habla.
        if (request.nextUrl.searchParams.get(G.marcaRebote) === "1") {
            return aplicarCspSiCorresponde(request, redirectAtLogin(request, "sesion"));
        }

        const alDia = new URL(G.caminoRebote, request.url);
        alDia.searchParams.set("destino", pathname);
        return aplicarCspSiCorresponde(request, NextResponse.redirect(alDia));
    }

    return aplicarCspSiCorresponde(request, NextResponse.next());
}
