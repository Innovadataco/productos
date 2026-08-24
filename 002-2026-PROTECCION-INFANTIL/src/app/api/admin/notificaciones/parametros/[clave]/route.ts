/**
 * SPEC-202 (002-PI-099): actualización de un parámetro del motor de notificaciones.
 *   PATCH — actualiza el valor de un parámetro cuya clave comienza con "notificaciones.".
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { parseBody } from "@/lib/validation";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";

const adminService = new NotificacionAdminService();

const paramsSchema = z.object({
    clave: z.string().min(1).max(120),
});

const patchSchema = z.object({
    valor: z.string().min(1).max(4000),
});

type RouteContext = { params: Promise<{ clave: string }> };

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "configuracion_notificaciones");
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { clave } = paramsSchema.parse(await context.params);
        const body = await parseBody(request, patchSchema);
        const actualizado = await adminService.actualizarParametro(clave, body, user.id);
        return NextResponse.json(actualizado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] PATCH parametro:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
