import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { sanitizeReturnTo, biBase } from "@/lib/auth/return-to";

// SPEC-036 · login propio de BI (una sola puerta). Reemplaza el SSO puente.
// Credenciales en el .env (BI_AUTH_USER / BI_AUTH_PASSWORD), leídas EN
// REQUEST TIME: editar el .env + reiniciar el contenedor toma efecto sin
// rebuild (requisito duro de Jelkin). Clave EN CLARO, comparación === (concesión
// consciente de Jelkin · no hash · Fase 1).

const isProd = (): boolean => process.env.NODE_ENV === "production";

interface Credenciales {
    usuario: string;
    password: string;
    returnTo: string | null;
}

async function leerCredenciales(req: Request): Promise<Credenciales> {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
        const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        return {
            usuario: typeof b.usuario === "string" ? b.usuario : "",
            password: typeof b.password === "string" ? b.password : "",
            returnTo: typeof b.returnTo === "string" ? b.returnTo : null,
        };
    }
    const f = await req.formData();
    const rt = f.get("returnTo");
    return {
        usuario: typeof f.get("usuario") === "string" ? String(f.get("usuario")) : "",
        password: typeof f.get("password") === "string" ? String(f.get("password")) : "",
        returnTo: typeof rt === "string" ? rt : null,
    };
}

export async function POST(req: Request): Promise<NextResponse> {
    // Env leídas EN REQUEST TIME (no en top-level del módulo).
    const USER = process.env.BI_AUTH_USER;
    const PASS = process.env.BI_AUTH_PASSWORD;
    const secret = process.env.JWT_SECRET;

    const { usuario, password, returnTo: returnToRaw } = await leerCredenciales(req);
    const returnTo = sanitizeReturnTo(returnToRaw);

    // Config incompleta o credenciales incorrectas → MISMO error (no filtra si
    // falló el usuario o la clave), sin cookie.
    if (!USER || !PASS || !secret || usuario !== USER || password !== PASS) {
        return NextResponse.redirect(
            new URL(
                `/login?error=1&returnTo=${encodeURIComponent(returnTo)}`,
                biBase(),
            ),
            302,
        );
    }

    // Firma el JWT `session` con el mismo shape que sesionDeRequest ya lee.
    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ sub: USER, role: "ADMIN" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + 60 * 60 * 24)
        .sign(new TextEncoder().encode(secret));

    const res = NextResponse.redirect(new URL(returnTo, biBase()), 302);
    res.cookies.set({
        name: "session",
        value: jwt,
        path: "/",
        httpOnly: true,
        secure: isProd(),
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
    });
    return res;
}
