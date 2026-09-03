import { NextRequest, NextResponse } from "next/server";
import { verificarAdmin } from "@/lib/auth/verificar";
import { emitirSesion } from "@/lib/auth/sesion";
import { registrarEventoAudit, ACCION_AUDIT } from "@/lib/bitacora/audit";

/**
 * Login propio del 006. El payload es exactamente { email, password } —
 * jamás se acepta `rol` ni ningún otro campo del cliente (regla dura).
 * Todo intento (OK o fallido) queda en la bitácora general (bi_audit_log);
 * la escritura es fail-open: nunca bloquea el login.
 */
export async function POST(request: NextRequest) {
    let cuerpo: { email?: unknown; password?: unknown };
    try {
        cuerpo = await request.json();
    } catch {
        return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    const { email, password } = cuerpo;
    if (typeof email !== "string" || typeof password !== "string") {
        return NextResponse.json({ error: "credenciales_invalidas" }, { status: 401 });
    }

    if (!verificarAdmin(email, password)) {
        await registrarEventoAudit({ accion: ACCION_AUDIT.LOGIN_FALLIDO, email });
        return NextResponse.json({ error: "credenciales_invalidas" }, { status: 401 });
    }

    await emitirSesion(email);
    await registrarEventoAudit({ accion: ACCION_AUDIT.LOGIN_OK, email });
    return NextResponse.json({ ok: true });
}
