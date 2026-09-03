/**
 * SPEC-408 · POST /api/admin/verificacion-profesionales/[id]/decidir
 *
 * ÚNICO endpoint de decisión — aprueba o devuelve según el checklist. La forma
 * se calcula en el service: todos `CUMPLE` → APROBADO, alguno `NO_CUMPLE` → RECHAZADO
 * (con observación obligatoria en cada uno). El endpoint es una capa fina.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { decidir, decidirSchema } from "@/lib/profesionales/verificador/service";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id } = await ctx.params;
        const body = decidirSchema.parse(await req.json());
        const resultado = await decidir(id, { id: user.id, email: user.email }, body);
        return NextResponse.json({
            data: {
                resultado: resultado.resultado,
                estadoPerfil: resultado.perfil.estado,
                verificacionId: resultado.verificacion.id,
            },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/DECIDIR]");
    }
}
