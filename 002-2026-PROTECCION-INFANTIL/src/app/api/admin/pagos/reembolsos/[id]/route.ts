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
import { pagosReembolsoBodySchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";

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
        const body = await withValidation.body(pagosReembolsoBodySchema)(request);

        const repo = new PagosRepository();
        const pago = await repo.obtenerPagoPorId(id);
        if (!pago) throw new AppError("Pago no encontrado", ERROR_CODES.NOT_FOUND, 404);
        if (pago.estado !== EstadoPago.AUTORIZADO) {
            throw new AppError("Solo se pueden reembolsar pagos autorizados", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (body.montoReembolsoUSD > pago.montoNetoUSD) {
            throw new AppError("El monto del reembolso no puede superar el monto neto del pago", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const actualizado = await repo.registrarReembolso(id, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PAGO_REEMBOLSADO",
            tipoRecurso: "Pago",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: pago.estado, montoNetoUSD: pago.montoNetoUSD }),
            valorNuevo: JSON.stringify({
                estado: actualizado.estado,
                montoReembolsoUSD: actualizado.montoReembolsoUSD,
                motivoReembolso: actualizado.motivoReembolso,
                referenciaReembolso: actualizado.referenciaReembolso,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ pago: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/REEMBOLSOS/ID]");
    }
}
