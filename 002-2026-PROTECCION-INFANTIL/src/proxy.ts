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
    "/api/apeaciones",
    "/apelar",
];

// Rutas de usuario final: solo PARENT (o anónimo) puede usarlas.
const USER_FINAL_ROUTES = ["/dashboard", "/mis-reportes", "/reportar"];

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

function esRolInterno(rol: string) {
    return rol === "ADMIN" || rol === "SCHOOL_ADMIN" || rol === "OPERADOR";
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value ?? request.cookies.get("__Host-token")?.value;

    // Public routes are always allowed for anonymous users.
    // Routes like /reportar are public for anonymous but not for internal users.
    const isPublicRoute = isPublic(pathname);

    // Internal routes (admin/operador panel and APIs)
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

    // Internal routes: require internal role (ADMIN, SCHOOL_ADMIN or OPERADOR)
    if (isInternalRoute) {
        if (!esRolInterno(payload.rol)) {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: { message: "Permisos insuficientes" } }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/", request.url));
        }
        return NextResponse.next();
    }

    // User-final routes: internal users (operador/admin) must not access them.
    if (isUserFinalRoute(pathname) && esRolInterno(payload.rol)) {
        return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)", "/reportar"],
};
