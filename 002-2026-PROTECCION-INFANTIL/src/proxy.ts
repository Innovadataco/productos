import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/registro", "/api/auth", "/api/config/parametros/publicos"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value;

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
    if (isPublic) return NextResponse.next();

    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

