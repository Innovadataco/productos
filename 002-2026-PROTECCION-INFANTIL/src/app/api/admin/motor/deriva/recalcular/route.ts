import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { calcularDeriva, leerParametrosDeriva, lunesSemanaBogota } from "@/lib/motor/deriva";

/**
 * POST /api/admin/motor/deriva/recalcular (SPEC-172, Pilar D.5)
 * Recalcula bajo demanda la ventana móvil actual (últimos ventana_dias días
 * hasta ahora) y la persiste bajo el lunes de esta semana (America/Bogota).
 * Audita MOTOR_DERIVA_RECALCULO solo con metadatos agregados (nunca textos de
 * reportes ni datos de personas).
 */
export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "estadisticas");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const params = await leerParametrosDeriva();
        const hasta = new Date();
        const desde = new Date(hasta.getTime() - params.ventanaDias * 24 * 60 * 60 * 1000);
        const semanaInicio = lunesSemanaBogota(hasta);

        const filas = await calcularDeriva(desde, hasta, semanaInicio);
        const alertadas = filas.filter((f) => f.alertada).length;

        await logAudit({
            accion: "MOTOR_DERIVA_RECALCULO",
            tipoRecurso: "DerivaMotorSnapshot",
            recursoId: semanaInicio.toISOString(),
            usuarioId: admin.id,
            metadatos: {
                desde: desde.toISOString(),
                hasta: hasta.toISOString(),
                semanaInicio: semanaInicio.toISOString(),
                ventanaDias: params.ventanaDias,
                categorias: filas.length,
                alertadas,
            },
        });

        logger.info(
            `[MotorDeriva] Recálculo bajo demanda: ok — ${filas.length} categorías (${alertadas} alertadas), semana=${semanaInicio.toISOString().slice(0, 10)}`
        );

        return NextResponse.json({
            semanaInicio: semanaInicio.toISOString(),
            desde: desde.toISOString(),
            hasta: hasta.toISOString(),
            filas,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[MotorDeriva] POST recalcular deriva: error", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
