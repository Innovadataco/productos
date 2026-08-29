/**
 * SPEC-202 (002-PI-099): operaciones sobre una plantilla concreta.
 *   PATCH — actualiza asunto/cuerpo/variables/activa (versión autoincremental).
 *   POST  — envía un preview al correo del admin logueado.
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

const claveParamsSchema = z.object({
    clave: z.string().min(1).max(200),
});

const patchSchema = z.object({
    asunto: z.string().max(300).optional(),
    cuerpoMarkdown: z.string().max(10000).optional(),
    variablesSchema: z.record(z.string(), z.unknown()).optional(),
    activa: z.boolean().optional(),
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

        const { clave } = claveParamsSchema.parse(await context.params);
        const body = await parseBody(request, patchSchema);
        const plantilla = await adminService.actualizarPlantilla(clave, body, user.id);
        return NextResponse.json(plantilla);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] PATCH plantilla:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request, context: RouteContext) {
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

        const { clave } = claveParamsSchema.parse(await context.params);
        const resultado = await adminService.enviarPreviewPlantilla(clave, user.email);
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] POST preview plantilla:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
