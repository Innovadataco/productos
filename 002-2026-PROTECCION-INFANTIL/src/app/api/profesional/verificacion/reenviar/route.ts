/**
 * SPEC-408 · POST /api/profesional/verificacion/reenviar — el profesional
 * vuelve a poner su perfil en la cola tras corregir. Sin límite de intentos.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { reenviarParaVerificacion } from "@/lib/profesionales/verificador/vista-profesional";
import { logAudit } from "@/lib/audit";

export async function POST() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_verificacion");
        await reenviarParaVerificacion(user.id);
        await logAudit({
            usuarioId: user.id,
            accion: "PROFESIONAL_VERIFICACION_MAS_INFO",
            tipoRecurso: "PerfilProfesional",
            recursoId: user.id,
            metadatos: { transicion: "BORRADOR -> EN_REVISION (reenvío del profesional)" },
        });
        return NextResponse.json({ data: { ok: true } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/VERIFICACION/REENVIAR]");
    }
}
