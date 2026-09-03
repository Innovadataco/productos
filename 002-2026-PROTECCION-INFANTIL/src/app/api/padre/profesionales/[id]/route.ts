/**
 * SPEC-392 (L3) · `GET /api/padre/profesionales/[id]` — perfil individual.
 *
 * Mismo allowlist que la lista (H-2). 404 cuando el id no existe **o** cuando
 * `estado !== ACTIVO` — la ficha de un profesional en revisión/rechazado no se
 * asoma al padre ni siquiera indirectamente. Rol PARENT; exento de vigencia.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }
        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);
        const perfil = await new PerfilProfesionalRepository().obtenerPublicoPorId(id);
        if (!perfil) {
            return NextResponse.json(
                { error: { message: "Profesional no encontrado.", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json(perfil);
    } catch (error) {
        return errorToResponse(error, "[PADRE/PROFESIONALES/DETALLE]");
    }
}
