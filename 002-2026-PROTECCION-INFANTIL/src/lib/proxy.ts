import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { GUARDIAS_ACCESO } from "@/lib/routing/guardias";

// SPEC-287 (002-PI-187): PUBLIC_ROUTES y SESION_ROUTES son alias a GUARDIAS_ACCESO
// (fuente única). El motor de autorización de este archivo (esDestinoPermitidoPorRol,
// proxy) sigue consumiéndolas por el mismo nombre.
const PUBLIC_ROUTES: readonly string[] = GUARDIAS_ACCESO.publicas;

// Rutas de usuario final: solo PARENT (o anónimo) puede usarlas; internos no.
const USER_FINAL_ROUTES = ["/dashboard", "/mis-reportes"];

// Rutas exclusivas del módulo Colegio.
const COLEGIO_ROUTES = ["/dashboard/colegio", "/api/me/colegio", "/api/colegio"];

// SPEC-211 (002-PI-111): APIs de cliente del módulo de pagos (suscripción propia,
// renovación, cancelación, aplicar bono de SPEC-216). La titularidad se verifica
// dentro de cada endpoint; las APIs administrativas viven bajo /api/admin/pagos.
const PAGOS_CLIENTE_ROUTES = ["/api/pagos"];

// SPEC-168: rutas exclusivas del Comité de Convivencia (rol COMITE_CONVIVENCIA).
const COMITE_CONVIVENCIA_ROUTES = ["/dashboard/colegio/comite", "/api/colegio/comite"];

// SPEC-173 (candado B): la gestión de integrantes del comité es exclusiva del
// rector (SCHOOL_ADMIN); el rol COMITE_CONVIVENCIA no puede administrarse a sí mismo.
const COMITE_INTEGRANTES_SOLO_RECTOR = ["/dashboard/colegio/comite/integrantes", "/api/colegio/comite/integrantes"];

// SPEC-287 (002-PI-187): SESION_ROUTES viene de GUARDIAS_ACCESO. Docstring histórico:
// I-35/I-35b (cambio contraseña + logout), I-111 (consentimiento), SPEC-287 (refresh
// de sesión_estado). El único punto de decisión operativa vive en middleware.ts.
const SESION_ROUTES: readonly string[] = GUARDIAS_ACCESO.sesion;

// SPEC-118 (D-37, decisión ZEUS): rutas públicas de SOLO LECTURA abiertas también al
// SCHOOL_ADMIN. El aislamiento total no aportaba seguridad (son estadísticas públicas
// agregadas, alcanzables incluso sin sesión) y creaba clics muertos: el logo apuntaba
// a "/" y el proxy rebotaba al panel. Se mantiene bloqueado: el área interna
// (/dashboard/admin, /api/admin), el área de padres (/dashboard, /mis-reportes) y
// /reportar (una cuenta institucional no reporta).
// "/consulta" no existe como página (la consulta pública vive en el home "/"), así que
// no hay ruta de página que abrir para ella: su superficie real es la API de abajo.
const PUBLICAS_LECTURA_SCHOOL_ADMIN = ["/", "/dashboard-publico", "/seguimiento"];

// APIs públicas de solo lectura que esas pantallas consumen (inventario SPEC-118):
// - home "/": el formulario de consulta llama a /api/consulta (GET/POST; el POST solo
//   evita exponer el identificador en la URL — es una consulta, no una escritura);
// - "/dashboard-publico": GET /api/estadisticas-publicas;
// - "/seguimiento": GET /api/reportes/seguimiento/[numero].
// OJO: NO se abre "/api/reportes" completo — su POST crea reportes y la cuenta
// institucional no reporta; solo el sub-árbol de seguimiento (GET, solo lectura).
const APIS_LECTURA_SCHOOL_ADMIN = ["/api/consulta", "/api/estadisticas-publicas", "/api/reportes/seguimiento"];

// SPEC-203 (002-PI-100): panel de preferencias/bandeja de notificaciones compartido
// por todos los roles autenticados (padre, rector, comités, operador, admin).
const RUTAS_PERFIL = ["/dashboard/perfil", "/api/notificaciones"];

function matchesRoute(pathname: string, route: string): boolean {
    // Coincidencia exacta o por prefijo de segmento. Para "/" el startsWith queda
    // "//" y nunca casa: la raíz NO abre el árbol entero.
    return pathname === route || pathname.startsWith(route + "/");
}

function esRutaPerfil(pathname: string): boolean {
    return RUTAS_PERFIL.some((route) => matchesRoute(pathname, route));
}

/**
 * Indica si un SCHOOL_ADMIN autenticado puede acceder a la ruta.
 * Además de las rutas del módulo Colegio, puede usar las rutas de sesión:
 * sin "/api/me" el header público no reconoce la sesión (I-25) y sin
 * "/cambiar-password" el cambio obligatorio de contraseña queda en bucle (C-9).
 * SPEC-118 (D-37): también el área pública de solo lectura (inicio, dashboard
 * público, seguimiento y sus APIs de consulta) — sigue sin entrar al área interna,
 * al área de padres ni a /reportar.
 * SPEC-203: también el panel de preferencias de notificaciones compartido.
 */
export function esRutaPermitidaSchoolAdmin(pathname: string): boolean {
    if (esRutaPerfil(pathname)) return true;
    if (isColegioRoute(pathname)) return true;
    if (PAGOS_CLIENTE_ROUTES.some((route) => matchesRoute(pathname, route))) return true;
    if (PUBLICAS_LECTURA_SCHOOL_ADMIN.some((route) => matchesRoute(pathname, route))) return true;
    if (APIS_LECTURA_SCHOOL_ADMIN.some((route) => matchesRoute(pathname, route))) return true;
    return SESION_ROUTES.some((route) => matchesRoute(pathname, route));
}

function isComiteConvivenciaRoute(pathname: string): boolean {
    return COMITE_CONVIVENCIA_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

/**
 * SPEC-168: el Comité de Convivencia solo puede usar sus propias rutas y las de
 * sesión (cambiar contraseña, /api/me, logout). No accede al resto del módulo
 * colegio ni al área de usuario final.
 * SPEC-173 (candado B): EXCLUYE la gestión de integrantes — esa pantalla/API es
 * solo del rector; se evalúa ANTES del prefijo "/dashboard/colegio/comite".
 */
function esRutaPermitidaComiteConvivencia(pathname: string): boolean {
    if (esRutaPerfil(pathname)) return true;
    if (COMITE_INTEGRANTES_SOLO_RECTOR.some((route) => matchesRoute(pathname, route))) return false;
    if (isComiteConvivenciaRoute(pathname)) return true;
    return SESION_ROUTES.some((route) => matchesRoute(pathname, route));
}

// Rutas públicas que los roles internos no pueden usar (la cuenta institucional no reporta).
const REPORTAR_ROUTE = "/reportar";

function getSecret(): Uint8Array | null {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return null;
    return new TextEncoder().encode(secret);
}

function isPublic(pathname: string): boolean {
    return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isUserFinalRoute(pathname: string): boolean {
    return USER_FINAL_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

/**
 * SPEC-113 (I-36): criterio único de "qué puede usar este rol" reutilizable FUERA del
 * middleware (el menú del header lo consume para ofrecer solo lo permitido, sin una
 * segunda fuente de verdad de permisos). Refleja las MISMAS reglas del proxyCore:
 * - rutas de usuario final (/dashboard, /mis-reportes): solo PARENT o anónimo;
 * - SCHOOL_ADMIN: colegio + rutas de sesión + área pública de solo lectura (SPEC-118/D-37);
 * - roles internos: no usuario final ni /reportar;
 * - anónimo: área pública/usuario final.
 */
export function esDestinoPermitidoPorRol(rol: string | null | undefined, pathname: string): boolean {
    if (!rol) return !pathname.startsWith("/dashboard/admin");
    if (esRutaPerfil(pathname)) return true;
    if (rol === "SCHOOL_ADMIN") return esRutaPermitidaSchoolAdmin(pathname);
    if (rol === "COMITE_CONVIVENCIA") return esRutaPermitidaComiteConvivencia(pathname);
    if (esRolInterno(rol)) {
        // Mismo orden que proxyCore: admin-only primero, luego el área interna, y solo
        // después usuario-final/reportar. Sin esto, "/dashboard/admin" caía en el
        // startsWith("/dashboard") de usuario-final y el criterio contradecía al proxy.
        if (esRutaAdminOnly(pathname) && !esRolAdmin(rol)) return false;
        if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/api/admin")) return true;
        if (isUserFinalRoute(pathname) || isReportarRoute(pathname)) return false;
        return true;
    }
    // PARENT: área de usuario final y rutas públicas; no área interna.
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/api/admin")) return false;
    return true;
}

function isColegioRoute(pathname: string): boolean {
    return COLEGIO_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isReportarRoute(pathname: string): boolean {
    return pathname === REPORTAR_ROUTE || pathname.startsWith(REPORTAR_ROUTE + "/");
}

async function verifyToken(token: string) {
    try {
        const secret = getSecret();
        if (!secret) return null;
        const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
        return payload as { sub: string; rol: string };
    } catch {
        return null;
    }
}

function redirectToLogin(request: NextRequest) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("token");
    res.cookies.delete("__Host-token");
    return res;
}

const INTERNAL_ROLES = new Set(["ADMIN", "OPERADOR", "COMITE_VALIDACION"]);
const ADMIN_ROLES = new Set(["ADMIN"]);

function esRolInterno(rol: string) {
    return INTERNAL_ROLES.has(rol);
}

function esRolAdmin(rol: string) {
    return ADMIN_ROLES.has(rol);
}

const ADMIN_ONLY_ROUTES = ["/dashboard/admin/comite/gestion", "/dashboard/admin/comite/auditoria"];

function esRutaAdminOnly(pathname: string) {
    return ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function homeForRole(rol: string) {
    if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    // SPEC-173 (FASE-C): el Comité de Convivencia aterriza en su panel de inicio.
    if (rol === "COMITE_CONVIVENCIA") return "/dashboard/colegio/comite";
    if (rol === "SCHOOL_ADMIN") return "/dashboard/colegio";
    // SPEC-127 (I-40, D-42): el padre va a su área de usuario final. Sin este caso caía
    // al default "/dashboard/admin", que la propia puerta le niega → doble rebote a "/".
    // SPEC-317 (002-PI-217): cambiado de "/dashboard" a "/dashboard/padre" (zona canónica).
    // esDestinoPermitidoPorRol para PARENT permite todo salvo admin — no hay riesgo de rebote.
    if (rol === "PARENT") return "/dashboard/padre";
    return "/dashboard/admin";
}

function redirectToHome(request: NextRequest, rol: string) {
    return NextResponse.redirect(new URL(homeForRole(rol), request.url));
}

async function proxyCore(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value ?? request.cookies.get("__Host-token")?.value;

    const isPublicRoute = isPublic(pathname);
    const isInternalRoute = pathname.startsWith("/dashboard/admin") || pathname.startsWith("/api/admin");

    // If no token, behave as before: public -> next, protected -> redirect/401
    if (!token) {
        if (isPublicRoute) return NextResponse.next();
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
        }
        return redirectToLogin(request);
    }

    const payload = await verifyToken(token);
    if (!payload) {
        if (isPublicRoute) return NextResponse.next();
        if (pathname.startsWith("/api/")) {
            const res = NextResponse.json({ error: { message: "Token inválido o expirado" } }, { status: 401 });
            res.cookies.delete("token");
            res.cookies.delete("__Host-token");
            return res;
        }
        return redirectToLogin(request);
    }

    const rol = payload.rol;

    // SPEC-203: panel de preferencias/bandeja de notificaciones para cualquier rol autenticado.
    if (esRutaPerfil(pathname)) return NextResponse.next();

    // SCHOOL_ADMIN: módulo colegio + sesión + área pública de solo lectura (SPEC-118/D-37).
    if (rol === "SCHOOL_ADMIN") {
        if (esRutaPermitidaSchoolAdmin(pathname)) return NextResponse.next();
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: { message: "Permisos insuficientes" } }, { status: 403 });
        }
        return redirectToHome(request, rol);
    }

    // SPEC-168: Comité de Convivencia — rutas propias + sesión, nada más.
    if (rol === "COMITE_CONVIVENCIA") {
        if (esRutaPermitidaComiteConvivencia(pathname)) return NextResponse.next();
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: { message: "Permisos insuficientes" } }, { status: 403 });
        }
        return redirectToHome(request, rol);
    }

    // Admin-only routes inside the admin area: must be checked before the generic internal route check.
    if (esRutaAdminOnly(pathname) && !esRolAdmin(rol)) {
        return redirectToHome(request, rol);
    }

    // Internal routes: require internal role (ADMIN, OPERADOR or COMITE_VALIDACION)
    if (isInternalRoute) {
        if (!esRolInterno(rol)) {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: { message: "Permisos insuficientes" } }, { status: 403 });
            }
            // El "/" es deliberado (aislamiento de roles, 2026-07-19): un rol no interno en
            // ruta interna cae a la raíz pública, no a su home. Además es el piso que impide
            // el bucle I-40/D-42 — homeForRole devuelve /dashboard/admin por defecto.
            // SPEC-317 evaluó cambiarlo a /dashboard/padre y se descartó (decisión CEO).
            return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
    }

    // User-final routes: internal users must not access them; redirect to their home area.
    if (isUserFinalRoute(pathname) && esRolInterno(rol)) {
        return redirectToHome(request, rol);
    }

    // /reportar is public for anonymous/PARENT, but not for internal platform roles.
    if (isReportarRoute(pathname) && esRolInterno(rol)) {
        return redirectToHome(request, rol);
    }

    return NextResponse.next();
}

/**
 * Middleware de autorización para rutas de Next.js.
 * Verifica el token JWT de la petición, decide si la ruta es pública, de administración
 * o de usuario final, y devuelve la respuesta apropiada (next, redirect o error 401/403).
 * No modifica el cuerpo de la petición.
 *
 * @param request - Petición entrante de Next.js.
 * @returns Respuesta de Next.js indicando si se permite el paso, redirige o rechaza.
 */
export async function proxy(request: NextRequest) {
    return proxyCore(request);
}

/**
 * Configuración de matcher del middleware de Next.js.
 * Indica las rutas que deben ejecutar el proxy de autorización.
 */
export const proxyConfig = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)", "/reportar"],
};
