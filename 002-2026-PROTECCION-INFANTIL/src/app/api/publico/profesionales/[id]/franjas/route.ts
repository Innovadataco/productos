/**
 * SPEC-395 (L4) · GET /api/publico/profesionales/[id]/franjas
 * Franjas libres futuras de un profesional ACTIVO (para el listado público).
 * No autenticada: es información pública del directorio.
 */
import { NextResponse } from "next/server";
import { errorToResponse } from "@/lib/api-handler";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        // L3 (#298): `obtenerPublicoPorId` filtra por `estado = ACTIVO` con la
        // allowlist del brief §5 — no destapa contacto ni campos internos.
        const perfil = await new PerfilProfesionalRepository().obtenerPublicoPorId(id);
        if (!perfil) {
            throw new AppError("Profesional no disponible", ERROR_CODES.NOT_FOUND, 404);
        }
        const franjas = await new FranjaDisponibleRepository().listarLibresDeProfesional(perfil.id, new Date());
        return NextResponse.json({
            data: franjas.map((f) => ({
                id: f.id,
                inicio: f.inicio.toISOString(),
                fin: f.fin.toISOString(),
                modalidad: f.modalidad,
            })),
        });
    } catch (error) {
        return errorToResponse(error, "[PUBLICO/PROFESIONAL/FRANJAS]");
    }
}
