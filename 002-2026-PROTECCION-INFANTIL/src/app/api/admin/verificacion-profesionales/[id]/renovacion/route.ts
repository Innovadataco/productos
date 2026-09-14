/**
 * SPEC-693 (I-416) · POST /api/admin/verificacion-profesionales/[id]/renovacion
 *
 * Revisa la RENOVACIÓN de UN requisito de un profesional activo: aprueba (la versión
 * nueva pasa a vigente) o devuelve (con observación obligatoria; sigue vigente la
 * anterior). Nunca toca la vigencia ni el estado del perfil — esos invariantes son
 * estructurales en el service/modelo. Capa fina: valida borde y delega.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { revisarRenovacion, revisarRenovacionSchema } from "@/lib/profesionales/verificador/renovacion";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id } = await ctx.params;
        const body = revisarRenovacionSchema.parse(await req.json());
        const resultado = await revisarRenovacion(id, { id: user.id, email: user.email }, body);
        return NextResponse.json({ data: resultado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/RENOVACION]");
    }
}
