import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseParams, withValidation } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { notificacionClaveParamsSchema, plantillaPreviewBodySchema } from "@/lib/schemas";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ clave: string }> };

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

        const { clave } = parseParams(await context.params, notificacionClaveParamsSchema);
        const body = await withValidation.body(plantillaPreviewBodySchema)(request);

        const servicio = new NotificacionAdminService();
        const adminEmail = await servicio.findAdminEmail(admin.id);
        if (!adminEmail) {
            return NextResponse.json(
                { error: { message: "No se encontró email del admin", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { proveedorId } = await servicio.enviarPreviewPlantilla(clave, adminEmail, body.variables);
        logger.info(`[NotificacionesAdmin] Preview enviado: ${clave} a ${adminEmail}`);
        return NextResponse.json({ enviado: true, proveedorId });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[NotificacionesAdmin] Error enviando preview:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
