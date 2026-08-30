import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyToken } from "@/lib/auth/jwt";
import { resolveBiBaseUrl } from "@/lib/bi/base-url";

// SPEC-029 · cierra I-30 · puente sesión PI→BI
// Recibe JWT ephemeral (TTL 60s, linkTo="bi") emitido por PI en
// /api/auth/link-bi, verifica firma con JWT_SECRET compartido, y setea
// cookie session de 24h que sesionDeRequest ya sabe leer.
// SPEC-030 · el host base se resuelve con resolveBiBaseUrl (proxy → env →
// prod THROW), nunca localhost silencioso en producción.

const ALLOW_PREFIXES = ["/dashboard", "/chat", "/api/bi/"];
const isProd = (): boolean => process.env.NODE_ENV === "production";

function sanitizeReturnTo(raw: string | null, biBase: string): string {
    if (!raw) return "/dashboard";
    let path = raw;
    // Si viene absoluta: aceptar solo el host de biBase y extraer
    // pathname+search. Cualquier otro host → silencioso a /dashboard.
    try {
        const u = new URL(raw);
        const bi = new URL(biBase);
        if (u.host !== bi.host) return "/dashboard";
        path = u.pathname + u.search;
    } catch {
        // no es URL absoluta · tratamos como relativa
    }
    if (!path.startsWith("/")) return "/dashboard";
    if (!ALLOW_PREFIXES.some((p) => path.startsWith(p))) return "/dashboard";
    return path;
}

function errRedirect(reason: string, biBase: string): NextResponse {
    return NextResponse.redirect(
        new URL(`/login-error?reason=${reason}`, biBase),
        302,
    );
}

export async function GET(req: Request): Promise<NextResponse> {
    // SPEC-030 · resuelto una vez al inicio. Si en prod falta proxy-header y
    // env, lanza (500 visible) en vez de degradar a localhost en silencio.
    const biBase = resolveBiBaseUrl(req.headers);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), biBase);

    if (!token) return errRedirect("invalid_token", biBase);

    const payload = await verifyToken(token);
    if (!payload) return errRedirect("invalid_token", biBase);

    // Chequeo redundante defensivo (jose.jwtVerify ya rechaza exp pasado).
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
        return errRedirect("expired", biBase);
    }
    if (payload.linkTo !== "bi") return errRedirect("bad_claim", biBase);

    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const role = typeof payload.role === "string" ? payload.role : null;
    if (!sub || !role) return errRedirect("bad_claim", biBase);

    const secret = process.env.JWT_SECRET;
    if (!secret) return errRedirect("invalid_token", biBase);

    // Re-firmar el JWT para la cookie session:
    // mismo sub/role (+ email si vino), SIN linkTo, TTL 24h.
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionPayload: Record<string, unknown> = { sub, role };
    if (typeof payload.email === "string") {
        sessionPayload.email = payload.email;
    }
    const sessionJwt = await new SignJWT(sessionPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 60 * 60 * 24)
        .sign(new TextEncoder().encode(secret));

    const res = NextResponse.redirect(new URL(returnTo, biBase), 302);
    res.cookies.set({
        name: "session",
        value: sessionJwt,
        path: "/",
        httpOnly: true,
        secure: isProd(),
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
    });
    return res;
}
