import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ROUTES = [
    "/",
    "/login",
    "/registro",
    "/recuperar",
    "/seguimiento",
    "/consulta",
    "/reportar",
    "/privacidad",
    "/terminos",
    "/offline",
    "/dashboard-publico",
    "/api/auth",
    "/api/config/parametros/publicos",
    "/api/plataformas",
    "/api/paises",
    "/api/ciudades",
    "/api/consulta",
    "/api/reportes",
    "/api/estadisticas-publicas",
    "/api/health",
    "/api/apelaciones",
    "/apelar",
];

// Rutas de usuario final: solo PARENT (o anónimo) puede usarlas; internos no.
const USER_FINAL_ROUTES = ["/dashboard", "/mis-reportes"];

// Rutas exclusivas del módulo Colegio.
const COLEGIO_ROUTES = ["/dashboard/colegio", "/api/me/colegio"];

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
    if (rol === "SCHOOL_ADMIN") return "/dashboard/colegio";
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
    const isColegio = isColegioRoute(pathname);

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

    // SCHOOL_ADMIN is isolated to colegio routes only.
    if (rol === "SCHOOL_ADMIN") {
        if (isColegio) return NextResponse.next();
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
