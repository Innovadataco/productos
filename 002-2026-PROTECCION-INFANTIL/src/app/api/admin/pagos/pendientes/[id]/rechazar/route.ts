import { NextResponse } from "next/server";
import { z } from "zod";
import { EstadoPago } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { withValidation } from "@/lib/validation";
import { getClientInfo } from "@/lib/pagos/api-helpers";

const rechazarBodySchema = z.object({
    motivo: z.string().min(10).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(z.object({ id: z.string().cuid() }))(await params);
        const body = await withValidation.body(rechazarBodySchema)(request);

        const repo = new PagosRepository();
        const pago = await repo.obtenerPagoPorId(id);
        if (!pago) throw new AppError("Pago no encontrado", ERROR_CODES.NOT_FOUND, 404);
        if (pago.estado !== EstadoPago.PENDIENTE_AUTORIZACION) {
            throw new AppError("El pago no está pendiente de autorización", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const actualizado = await repo.actualizarPago(id, {
            estado: EstadoPago.RECHAZADO,
            motivoRechazo: body.motivo,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PAGO_RECHAZADO",
            tipoRecurso: "Pago",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: pago.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado, motivoRechazo: body.motivo }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ pago: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PENDIENTES/RECHAZAR]");
    }
}
