/**
 * SPEC-395 (L4) · GET /api/admin/pagos/cita/pendientes
 * Lista de solicitudes SIN_CONFIRMAR esperando aprobación manual del pago.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";

export async function GET() {
    try {
        await verifyAuth(["ADMIN", "OPERADOR"]);
        const solicitudes = await new SolicitudCitaRepository().listarPendientesAprobacionPago();
        return NextResponse.json({ data: solicitudes });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CITA/PENDIENTES]");
    }
}
