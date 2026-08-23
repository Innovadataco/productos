import { NextResponse } from "next/server";
import { EstadoPago } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { z } from "zod";
import { withValidation } from "@/lib/validation";
import { getClientInfo } from "@/lib/pagos/api-helpers";

const autorizarBodySchema = z.object({
    duracionCubierta: z.enum(["MES_1", "MES_2", "MES_3", "MES_6", "MES_12"]).optional(),
    notas: z.string().max(500).optional(),
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
        const body = await withValidation.body(autorizarBodySchema)(request);

        const repo = new PagosRepository();
        const pago = await repo.obtenerPagoPorId(id);
        if (!pago) throw new AppError("Pago no encontrado", ERROR_CODES.NOT_FOUND, 404);
        if (pago.estado !== EstadoPago.PENDIENTE_AUTORIZACION) {
            throw new AppError("El pago no está pendiente de autorización", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const updateData: Parameters<typeof repo.actualizarPago>[1] = {
            estado: EstadoPago.AUTORIZADO,
            fechaAutorizacion: new Date(),
            autorizadoPorAdminId: admin.id,
        };
        if (body.duracionCubierta) updateData.duracionCubierta = body.duracionCubierta;

        const actualizado = await repo.actualizarPago(id, updateData);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PAGO_AUTORIZADO",
            tipoRecurso: "Pago",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: pago.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado, notas: body.notas }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ pago: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PENDIENTES/AUTORIZAR]");
    }
}
