import { NextResponse } from "next/server";
import { EstadoPago, EstadoSuscripcion } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { procesarRecompensasPagoAutorizado } from "@/lib/pagos/referido.service";
import { extenderVigenciaDesdeFreemium } from "@/lib/pagos/freemium.service";
import { autorizarSolicitudPendiente } from "@/lib/pagos/admin-autorizar-solicitud.service";
import { z } from "zod";
import { withValidation } from "@/lib/validation";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { pagosAutorizarSolicitudBodySchema } from "@/lib/schemas/pagos";

const autorizarPagoBodySchema = z.object({
    duracionCubierta: z.enum(["MES_1", "MES_2", "MES_3", "MES_6", "MES_12"]).optional(),
    notas: z.string().max(500).optional(),
});

async function autorizarPago(id: string, request: Request, admin: { id: string }): Promise<Response> {
    const body = await withValidation.body(autorizarPagoBodySchema)(request);

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

    // SPEC-215 (002-PI-115): hook del evento interno `pago.autorizado` — activa
    // el uso de referido pendiente y otorga las recompensas. Fail-open.
    try {
        await procesarRecompensasPagoAutorizado(id, admin.id);
    } catch (err) {
        console.error(
            `[Referidos] Hook pago.autorizado: error — pago ${id}: ${err instanceof Error ? err.message : "desconocido"}`
        );
    }

    // SPEC-217 (002-PI-117): hook `pago.autorizado` sobre suscripción freemium.
    // Fail-open.
    try {
        await extenderVigenciaDesdeFreemium({
            suscripcionId: actualizado.suscripcionId,
            duracionCubierta: actualizado.duracionCubierta,
            actorAdminId: admin.id,
            ipAddress,
            userAgent,
        });
    } catch (err) {
        console.error(
            `[Freemium] Hook pago.autorizado: error — pago ${id}: ${err instanceof Error ? err.message : "desconocido"}`
        );
    }

    return NextResponse.json({ pago: actualizado });
}

async function autorizarSuscripcionPendiente(id: string, request: Request, admin: { id: string }): Promise<Response> {
    const body = await withValidation.body(pagosAutorizarSolicitudBodySchema)(request);
    const { ipAddress, userAgent } = getClientInfo(request);

    const suscripcion = await autorizarSolicitudPendiente({
        adminId: admin.id,
        suscripcionId: id,
        metodoPagoManual: body.metodoPagoManual,
        referenciaPagoManual: body.referenciaPagoManual,
        montoRealPagado: body.montoRealPagado,
        fechaPagoReal: body.fechaPagoReal,
        ipAddress,
        userAgent,
    });

    return NextResponse.json({ suscripcion });
}

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

        const repo = new PagosRepository();
        const pago = await repo.obtenerPagoPorId(id);
        if (pago) {
            return await autorizarPago(id, request, admin);
        }

        const suscripcion = await repo.obtenerSuscripcionPorId(id);
        if (suscripcion && suscripcion.estado === EstadoSuscripcion.PENDIENTE_AUTORIZACION) {
            return await autorizarSuscripcionPendiente(id, request, admin);
        }

        if (suscripcion) {
            throw new AppError("La solicitud ya no está pendiente de autorización", ERROR_CODES.CONFLICT, 409);
        }

        throw new AppError("Pago o solicitud no encontrado", ERROR_CODES.NOT_FOUND, 404);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PENDIENTES/AUTORIZAR]");
    }
}
