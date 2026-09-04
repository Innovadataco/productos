/**
 * SPEC-427 (A-75 · L6) · POST /api/profesional/citas/[id]/no-asistio
 *
 * El otro estado de cierre: la familia no se presentó. Va sin código —no hay
 * quién lo dicte— y por eso lo que lo sostiene es la declaración cruzada que
 * SPEC-429 compara contra la encuesta del padre.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { marcarNoAsistioElPadre } from "@/lib/profesional/cita/cierre.service";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await ctx.params;
        const r = await marcarNoAsistioElPadre(id, user.id);
        return NextResponse.json({ data: r });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/CITAS/NO-ASISTIO]");
    }
}
