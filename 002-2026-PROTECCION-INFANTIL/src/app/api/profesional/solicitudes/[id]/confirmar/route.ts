/**
 * SPEC-395 (L4) · PATCH /api/profesional/solicitudes/[id]/confirmar
 * El profesional acepta la cita (dentro de las 48h): pasa a CONFIRMADA y desde
 * ese instante el DTO al padre expone el contacto.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { confirmarPorProfesional } from "@/lib/profesional/cita/cita.service";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_citaciones");
        const { id } = await context.params;
        const solicitud = await confirmarPorProfesional(id, user.id);
        return NextResponse.json({ data: { id: solicitud.id, estado: solicitud.estado } });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/SOLICITUD/CONFIRMAR]");
    }
}
