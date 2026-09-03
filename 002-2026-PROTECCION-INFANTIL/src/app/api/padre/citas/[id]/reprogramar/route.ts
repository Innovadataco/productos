/**
 * SPEC-395 (L4) · POST /api/padre/citas/[id]/reprogramar
 * Una gratis por dupla padre × profesional; el service impone el candado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { reprogramarPorPadre } from "@/lib/profesional/cita/cita.service";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

const bodySchema = z.object({ nuevaFranjaId: z.string().uuid() });

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
        // Cargar con relaciones para el DTO
        const conRelaciones = await new SolicitudCitaRepository().findParaPadre(nueva.id, user.id);
        return NextResponse.json({ data: conRelaciones ? toCitaParaPadre(conRelaciones) : nueva });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/REPROGRAMAR]");
    }
}
