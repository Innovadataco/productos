import { NextRequest, NextResponse } from "next/server";
import { verificarAdmin } from "@/lib/auth/verificar";
import { emitirSesion } from "@/lib/auth/sesion";

/**
 * Login propio del 006. El payload es exactamente { email, password } —
 * jamás se acepta `rol` ni ningún otro campo del cliente (regla dura).
 */
export async function POST(request: NextRequest) {
    let cuerpo: { email?: unknown; password?: unknown };
    try {
        cuerpo = await request.json();
    } catch {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    const { email, password } = cuerpo;
    if (typeof email !== "string" || typeof password !== "string" || !verificarAdmin(email, password)) {
        return NextResponse.json({ error: "credenciales_invalidas" }, { status: 401 });
    }

    await emitirSesion(email);
    return NextResponse.json({ ok: true });
}
