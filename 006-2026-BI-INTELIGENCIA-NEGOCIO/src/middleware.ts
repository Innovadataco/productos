import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Guard de sesión propia del 006 — CERRADO POR DEFECTO (CEO 31-08-2026):
 * sin sesión válida no se ve nada. BI NO comparte login/JWT/cookie con PI.
 *
 * SE2: cualquier error de verificación = fail-closed (a /login o 401).
 * SE3: las únicas rutas exentas son /login y las APIs públicas listadas;
 *      el destino del redirect (/login) está exento, así que no hay bucle.
 * D4:  request.url MIENTE detrás del proxy — el redirect absoluto se arma
 *      con x-forwarded-host/proto y cae a NEXT_PUBLIC_APP_URL.
 */
const RUTAS_PUBLICAS = new Set(["/login"]);
const APIS_PUBLICAS = new Set(["/api/auth/login", "/api/bi/estado-sistema"]);
const COOKIE_SESION = "bi_sesion";

async function sesionValida(token: string | undefined): Promise<boolean> {
    const secreto = process.env.BI_AUTH_SECRET;
    if (!token || !secreto) return false;
    try {
        await jwtVerify(token, new TextEncoder().encode(secreto));
        return true;
    } catch {
        return false;
    }
}

function urlPublica(request: NextRequest, path: string): string {
    const fallback = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://bi.innovadataco.com");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? fallback.host;
    const proto = request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");
    return `${proto}://${host}${path}`;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const esApi = pathname.startsWith("/api/");

    if (!esApi && RUTAS_PUBLICAS.has(pathname)) return NextResponse.next();
    if (esApi && APIS_PUBLICAS.has(pathname)) return NextResponse.next();

    if (await sesionValida(request.cookies.get(COOKIE_SESION)?.value)) {
        return NextResponse.next();
    }

    if (esApi) {
        return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(urlPublica(request, "/login"));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
