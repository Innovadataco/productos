/**
 * SPEC-395 (L4) · POST /api/admin/pagos/cita/[id]/activar
 * ADMIN aprueba el pago manual → SIN_CONFIRMAR pasa a PAGADA_PENDIENTE con
 * `pagoAprobadoEn = now` (arranca el reloj de 48h del profesional).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { aprobarPago } from "@/lib/profesional/cita/cita.service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const { id } = await context.params;
        const solicitud = await aprobarPago(id, admin.id);
        return NextResponse.json({ data: { id: solicitud.id, estado: solicitud.estado, pagoAprobadoEn: solicitud.pagoAprobadoEn } });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CITA/ACTIVAR]");
    }
}
