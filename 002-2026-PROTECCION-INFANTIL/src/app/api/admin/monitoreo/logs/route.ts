import { NextResponse } from "next/server";
import { verifyAuth, getUserFromToken } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { auditAccesoDenegado } from "@/lib/audit";
import { listarLogs, purgarLogs, type ListarLogsInput, type PurgarLogsInput } from "@/lib/monitoreo/logs-service";
import {
    monitoreoLogsQuerySchema,
    monitoreoLogsPurgeSchema,
} from "@/lib/schemas";

async function auditarSiAccesoDenegado(error: unknown, request: Request): Promise<void> {
    if (error instanceof AppError && error.statusCode === 403) {
        const user = await getUserFromToken(request).catch(() => null);
        await auditAccesoDenegado({
            request,
            ...(user?.id ? { usuarioId: user.id } : {}),
            recurso: "WorkerLog",
            metadatos: { endpoint: request.method, url: request.url },
        });
    }
}

/**
 * GET /api/admin/monitoreo/logs (SPEC-193 Fase 2)
 * Lista logs de workers con filtros de servicio, nivel, rango de fechas y búsqueda.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "monitoreo_worker");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const raw = Object.fromEntries(searchParams.entries());
        const parsed = monitoreoLogsQuerySchema.parse(raw);

        const desde = parsed.desde ? new Date(parsed.desde) : undefined;
        const hasta = parsed.hasta ? new Date(parsed.hasta) : undefined;

        if (desde && hasta && desde > hasta) {
            throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const listarInput: ListarLogsInput = {
            ...(parsed.servicio ? { servicio: parsed.servicio } : {}),
            ...(parsed.nivel ? { nivel: parsed.nivel } : {}),
            ...(desde ? { desde } : {}),
            ...(hasta ? { hasta } : {}),
            ...(parsed.q ? { q: parsed.q } : {}),
            limit: parsed.limit,
            offset: parsed.offset,
        };

        const { items, total } = await listarLogs(listarInput);

        return NextResponse.json({ items, total });
    } catch (error) {
        await auditarSiAccesoDenegado(error, request);
        return errorToResponse(error, "[ADMIN/MONITOREO/LOGS]");
    }
}

/**
 * DELETE /api/admin/monitoreo/logs (SPEC-193 Fase 2)
 * Purga logs anteriores a una fecha, opcionalmente filtrados por servicio/nivel.
 * Requiere motivo documentado y genera AuditLog.
 */
export async function DELETE(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "monitoreo_worker");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = monitoreoLogsPurgeSchema.parse(body);

        const purgarInput: PurgarLogsInput = {
            hasta: new Date(parsed.hasta),
            ...(parsed.servicio ? { servicio: parsed.servicio } : {}),
            ...(parsed.nivel ? { nivel: parsed.nivel } : {}),
            motivo: parsed.motivo,
            ejecutadoPorId: admin.id,
        };

        const resultado = await purgarLogs(purgarInput);

        return NextResponse.json(resultado);
    } catch (error) {
        await auditarSiAccesoDenegado(error, request);
        return errorToResponse(error, "[ADMIN/MONITOREO/LOGS]");
    }
}
