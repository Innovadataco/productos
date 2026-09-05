/**
 * SPEC-395 (L4) · DELETE /api/profesional/franjas/[id]
 * Elimina una franja SOLO si sigue libre (no toma padre pendiente).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_calendario");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const { id } = await context.params;
        const repo = new FranjaDisponibleRepository();
        const franja = await repo.findById(id);
        if (!franja || franja.profesionalId !== perfil.id) {
            throw new AppError("Franja no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        const res = await repo.borrarSiLibre(id);
        if (res.count === 0) {
            throw new AppError("La franja está tomada por un padre y no puede eliminarse", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        return NextResponse.json({ data: { eliminado: true } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/DELETE]");
    }
}
