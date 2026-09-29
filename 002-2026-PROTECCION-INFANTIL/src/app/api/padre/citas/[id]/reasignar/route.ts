/**
 * SPEC-395 (L4) · POST /api/padre/citas/[id]/reasignar
 * Traslado a otro profesional (hereda el pago). Solo cuando la cita quedó
 * VENCIDA_SIN_RESPUESTA o NO_ASISTIO_PROFESIONAL. El service impone el candado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { cuidIdSchema } from "@/lib/schemas/base";
import { reasignarPorPadre } from "@/lib/profesional/cita/cita.service";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

// SPEC-444 (I-310): los ids de PerfilProfesional y FranjaDisponible son cuid().
const bodySchema = z.object({
    nuevoProfesionalId: cuidIdSchema,
    nuevaFranjaId: cuidIdSchema,
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await context.params;
        const { nuevoProfesionalId, nuevaFranjaId } = bodySchema.parse(await request.json());
        const nueva = await reasignarPorPadre({
            padreUsuarioId: user.id,
            solicitudId: id,
            nuevoProfesionalId,
            nuevaFranjaId,
        });
        // SPEC-750: NUNCA el modelo CRUDO (`nueva`) — al poblar el enlace filtraría la
        // URL/operador al padre. DTO siempre; si la recarga falla, fail-closed.
        const conRelaciones = await new SolicitudCitaRepository().findParaPadre(nueva.id, user.id);
        if (!conRelaciones) {
            throw new AppError("No se pudo cargar la cita reasignada", ERROR_CODES.NOT_FOUND, 404);
        }
        return NextResponse.json({ data: toCitaParaPadre(conRelaciones) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/REASIGNAR]");
    }
}
