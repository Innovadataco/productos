/**
 * SPEC-202 (002-PI-099): operaciones sobre una regla concreta.
 *   PATCH — actualiza offset/canal/plantilla/activa; si cambia el offset de una
 *           regla activa, exige confirmación para recalcular programaciones.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { RolUsuario, CanalNotificacion } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";
import { parseBody } from "@/lib/validation";

const adminService = new NotificacionAdminService();

const paramsSchema = z.object({
    id: z.string().cuid(),
});

const OFFSET_REGEX = new RegExp("^[+-]\\d+[dhm]$");

const patchSchema = z.object({
    offset: z.string().regex(OFFSET_REGEX, "Offset inválido: formato [+-]N[d|h|m]").optional(),
    canal: z.nativeEnum(CanalNotificacion).optional(),
    plantillaClave: z.string().min(1).max(120).optional(),
    obligatoria: z.boolean().optional(),
    activa: z.boolean().optional(),
    confirmRecalcular: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

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

        const { id } = paramsSchema.parse(await context.params);
        const body = await parseBody(request, patchSchema);
        const resultado = await adminService.actualizarRegla(id, body, user.id, body.confirmRecalcular);

        if ("requiereConfirmacion" in resultado) {
            return NextResponse.json(resultado, { status: 409 });
        }

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] PATCH regla:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
