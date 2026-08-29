import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseParams } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { notificacionIdParamsSchema } from "@/lib/schemas";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";

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
        const resultado = await new NotificacionAdminService().reenviarNotificacion(id);
        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
