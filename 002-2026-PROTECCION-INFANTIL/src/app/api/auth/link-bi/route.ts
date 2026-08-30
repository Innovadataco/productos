/**
 * SPEC-310 (002-PI-211 · I-30 parte PI): puente de sesión PI→BI.
 *
 * La cookie `__Host-token` no puede cruzar a bi.innovadataco.com (el prefijo
 * __Host- prohíbe Domain). Este endpoint valida la sesión PI actual
 * (reutiliza verifyAuth() — cero reimplementación de lectura de cookie ni
 * verificación de JWT) y emite un JWT efímero de un solo uso (TTL 60s) que
 * BI intercambia por su propia cookie de sesión en /api/auth/link.
 *
 * NO toca __Host-token, login, logout, ni verifyToken/verifyAuth existentes.
 */
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { verifyAuth } from "@/lib/auth";
import { validarReturnTo } from "@/lib/auth/validar-return-to";
import { requireEnv } from "@/lib/env";

function getSecret(): Uint8Array {
    return new TextEncoder().encode(requireEnv("JWT_SECRET", 32));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const returnToOriginal = searchParams.get("returnTo");
    const returnTo = validarReturnTo(returnToOriginal);

    let user;
    try {
        user = await verifyAuth();
    } catch {
        const puenteUrl = `/api/auth/link-bi?returnTo=${encodeURIComponent(returnTo)}`;
        return NextResponse.redirect(
            new URL(`/login?returnTo=${encodeURIComponent(puenteUrl)}`, request.url),
            { status: 302 }
        );
    }

    // Contrato bilateral con BI (src/lib/auth/sesion.ts:27 del producto 005):
    // claim `role` singular string, NO `roles` arreglo.
    const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        role: user.rol,
        linkTo: "bi",
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("60s")
        .sign(getSecret());

    const biBaseUrl = requireEnv("BI_BASE_URL");
    const destino = `${biBaseUrl}/api/auth/link?token=${token}&returnTo=${encodeURIComponent(returnTo)}`;

    return NextResponse.redirect(destino, { status: 302 });
}
