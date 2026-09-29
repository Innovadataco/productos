import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { asignarOperadorACita } from "@/lib/operadores/asignador-citas";

/**
 * SPEC-750/T014 · POST /api/admin/operadores/asignar-cita/[id]
 * El admin resuelve la capacidad: intenta asignar un operador libre a una cita CONFIRMADA que
 * quedó sin asignar. Reusa el MOTOR (`asignarOperadorACita`, con simultaneidad) — mismo criterio
 * que el trigger automático; acá lo dispara un humano desde el tablero. Si sigue sin operador
 * libre en la ventana, responde 409 con la razón (no inventa una asignación solapada).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const { id } = await context.params;
        const r = await asignarOperadorACita(id);
        if (!r.asignado) {
            return NextResponse.json({ error: { message: r.razon, code: ERROR_CODES.CONFLICT } }, { status: 409 });
        }
        return NextResponse.json({ ok: true, operadorId: r.operadorId });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES/ASIGNAR-CITA]");
    }
}
