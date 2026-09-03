/**
 * SPEC-395 (L4) · PATCH /api/profesional/solicitudes/[id]/rechazar
 * El profesional rechaza la cita: pasa a VENCIDA_SIN_RESPUESTA y libera la
 * franja. El padre queda habilitado a reasignar (una gratis).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { rechazarPorProfesional } from "@/lib/profesional/cita/cita.service";

const bodySchema = z.object({ motivo: z.string().trim().min(1).max(500).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const { id } = await context.params;
        // El body es opcional; si no hay JSON válido, sigue con motivo undefined.
        let motivo: string | undefined;
        try {
            const parsed = bodySchema.parse(await request.json());
            motivo = parsed.motivo;
        } catch { /* body vacío o no JSON = sin motivo */ }
        const solicitud = await rechazarPorProfesional(id, user.id, motivo);
        return NextResponse.json({ data: { id: solicitud.id, estado: solicitud.estado } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/SOLICITUD/RECHAZAR]");
    }
}
