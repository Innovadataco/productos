/**
 * SPEC-408 · GET /api/admin/verificacion-profesionales/[id] — ficha vista por
 * el Verificador. Audita cada apertura (`PROFESIONAL_VERIFICACION_CONSULTADO`
 * · brief §5).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { abrirFicha } from "@/lib/profesionales/verificador/service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id } = await ctx.params;
        const ficha = await abrirFicha(id);
        await logAudit({
            usuarioId: user.id,
            accion: "PROFESIONAL_VERIFICACION_CONSULTADO",
            tipoRecurso: "PerfilProfesional",
            recursoId: id,
        });
        return NextResponse.json({ data: ficha });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/GET]");
    }
}
