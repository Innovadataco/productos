import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ROUTES = [
    "/",
    "/login",
    "/registro",
    "/reportar",
    "/seguimiento",
    "/api/auth",
    "/api/config/parametros/publicos",
    "/api/plataformas",
    "/api/paises",
    "/api/ciudades",
    "/api/consulta",
    "/api/reportes",
];

function getSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET no configurado o muy corto");
    }
    return new TextEncoder().encode(secret);
}

function isPublic(pathname: string): boolean {
    return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value;

    // Admin routes require ADMIN role
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/api/admin")) {
        if (!token) {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
            }
            return NextResponse.redirect(new URL("/login", request.url));
        }

        try {
            const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
            if (payload.rol !== "ADMIN") {
                if (pathname.startsWith("/api/admin")) {
                    return NextResponse.json({ error: { message: "Permisos insuficientes" } }, { status: 403 });
                }
                return NextResponse.redirect(new URL("/", request.url));
            }
            return NextResponse.next();
        } catch {
            if (pathname.startsWith("/api/admin")) {
                return NextResponse.json({ error: { message: "Token inválido" } }, { status: 401 });
            }
            return NextResponse.redirect(new URL("/login", request.url));
        }
    }

    // Public routes are always allowed
    if (isPublic(pathname)) {
        return NextResponse.next();
    }

    // Other protected routes require any authentication
    if (!token) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
