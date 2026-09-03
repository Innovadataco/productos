/**
 * SPEC-395 (L4) · POST /api/padre/citas/[id]/reasignar
 * Traslado a otro profesional (hereda el pago). Solo cuando la cita quedó
 * VENCIDA_SIN_RESPUESTA o NO_ASISTIO_PROFESIONAL. El service impone el candado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { reasignarPorPadre } from "@/lib/profesional/cita/cita.service";
import { toCitaParaPadre } from "@/lib/profesional/cita/dto";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

const bodySchema = z.object({
    nuevoProfesionalId: z.string().uuid(),
    nuevaFranjaId: z.string().uuid(),
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
        const conRelaciones = await new SolicitudCitaRepository().findParaPadre(nueva.id, user.id);
        return NextResponse.json({ data: conRelaciones ? toCitaParaPadre(conRelaciones) : nueva });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CITAS/REASIGNAR]");
    }
}
