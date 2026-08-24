import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseParams, withValidation } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { notificacionIdParamsSchema, reglaRecalcularBodySchema } from "@/lib/schemas";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "configuracion_notificaciones");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = parseParams(await context.params, notificacionIdParamsSchema);
        const body = await withValidation.body(reglaRecalcularBodySchema)(request);

        const servicio = new NotificacionAdminService();
        const regla = await servicio.obtenerRegla(id);
        if (!regla) {
            return NextResponse.json(
                { error: { message: "Regla no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const resultado = await servicio.recalcularEvento(regla.evento, body.motivo);

        await logAudit({
            accion: "NOTIFICACION_REGLA_ACTUALIZADA",
            tipoRecurso: "NotificacionRegla",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ accion: "recalculo_manual", evento: regla.evento }),
            valorNuevo: JSON.stringify({
                recalculadas: resultado.recalculadas,
                motivo: body.motivo,
            }),
            metadatos: { recalculadas: resultado.recalculadas, evento: regla.evento },
        });

        logger.info(`[NotificacionesAdmin] Recálculo ejecutado: ${regla.evento} por ${admin.id} (${resultado.recalculadas} notificaciones)`);
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[NotificacionesAdmin] Error recalculando regla:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
