/**
 * SPEC-202 (002-PI-099): parámetros del motor de notificaciones.
 *   GET — listado de parámetros cuya clave comienza con "notificaciones.".
 */
import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";

const adminService = new NotificacionAdminService();

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "configuracion_notificaciones");
        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const items = await adminService.listarParametros();
        return NextResponse.json({ items });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] GET parametros:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
