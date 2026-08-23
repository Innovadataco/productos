/**
 * SPEC-202 (002-PI-099): bandeja de envíos del motor de notificaciones.
 *   GET  — listado paginado y filtrable (sin PII ni textos de reportes).
 *   POST — reenvío manual de un envío finalizado.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { EstadoNotificacion, CanalNotificacion, RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { parseBody } from "@/lib/validation";
import { clampPage, clampPageSize } from "@/lib/pagination";
import { NotificacionAdminService } from "@/lib/dal/services/notificacion-admin";

const adminService = new NotificacionAdminService();

const bandejaQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    evento: z.string().max(120).optional(),
    canal: z.nativeEnum(CanalNotificacion).optional(),
    estado: z.nativeEnum(EstadoNotificacion).optional(),
    destinatarioEmail: z.string().max(255).optional(),
    fechaDesde: z.string().date().optional(),
    fechaHasta: z.string().date().optional(),
});

const reenviarSchema = z.object({
    id: z.string().cuid(),
});

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

        const url = new URL(request.url);
        const parsed = bandejaQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await adminService.listarBandeja({
            ...parsed.data,
            page: parsed.data.page,
            pageSize: parsed.data.pageSize,
        });

        return NextResponse.json({
            items: resultado.items,
            pagination: {
                page: resultado.page,
                pageSize: resultado.pageSize,
                total: resultado.total,
                totalPages: Math.ceil(resultado.total / resultado.pageSize),
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] GET bandeja:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
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

        const body = await parseBody(request, reenviarSchema);
        const resultado = await adminService.reenviarNotificacion(body.id);
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[NotificacionesAdmin] POST reenviar:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
