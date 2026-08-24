/**
 * SPEC-211 (002-PI-111): POST /api/pagos/suscripcion/cancelar
 *
 * Cancelación de la suscripción por el propio cliente (la UI pide triple
 * confirmación). Borrado lógico: estado CANCELADA, datos preservados, AuditLog.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { pagosCancelarSuscripcionBodySchema } from "@/lib/schemas/pagos";
import { cancelarSuscripcionCliente } from "@/lib/pagos/cancelacion.service";
import { verificarTitularidad } from "@/lib/pagos/suscripcion-vista.service";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { auditAccesoDenegado } from "@/lib/audit";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth(["SCHOOL_ADMIN", "PARENT"]);
        const rate = await checkRateLimit(request, "pagos_write", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(pagosCancelarSuscripcionBodySchema)(request);

        const propia = await verificarTitularidad(body.suscripcionId, usuario);
        if (!propia) {
            await auditAccesoDenegado({
                request,
                usuarioId: usuario.id,
                recurso: "CancelarSuscripcion",
                metadatos: { suscripcionId: body.suscripcionId },
            });
            throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        const resultado = await cancelarSuscripcionCliente({
            suscripcionId: body.suscripcionId,
            motivo: body.motivo,
            usuario,
            ipAddress,
            userAgent,
        });

        return NextResponse.json(
            { estado: resultado.estado, canceladaEn: resultado.canceladaEn.toISOString() },
            { status: 200 }
        );
    } catch (error) {
        return errorToResponse(error, "[PAGOS/SUSCRIPCION-CANCELAR]");
    }
}
