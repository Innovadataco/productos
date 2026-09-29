/**
 * SPEC-395 (L4) · POST /api/padre/citas/[id]/reprogramar
 * Una gratis por dupla padre × profesional; el service impone el candado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { cuidIdSchema } from "@/lib/schemas/base";
import { reprogramarPorPadre } from "@/lib/profesional/cita/cita.service";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

// SPEC-444 (I-310): el id de FranjaDisponible es cuid(), no uuid.
const bodySchema = z.object({ nuevaFranjaId: cuidIdSchema });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await context.params;
        const { nuevaFranjaId } = bodySchema.parse(await request.json());
        const nueva = await reprogramarPorPadre({
            padreUsuarioId: user.id,
            solicitudId: id,
            nuevaFranjaId,
        });
        // Cargar con relaciones para el DTO. SPEC-750: NUNCA devolver el modelo CRUDO
        // (`nueva`) — al poblar el enlace (SPEC-758/750) filtraría la URL/operador al
        // padre. Si la recarga falla, fail-closed; el cliente refresca.
        const conRelaciones = await new SolicitudCitaRepository().findParaPadre(nueva.id, user.id);
        if (!conRelaciones) {
            throw new AppError("No se pudo cargar la cita reprogramada", ERROR_CODES.NOT_FOUND, 404);
        }
        return NextResponse.json({ data: toCitaParaPadre(conRelaciones) });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/REPROGRAMAR]");
    }
}
