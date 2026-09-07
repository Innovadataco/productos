import { NextResponse } from "next/server";
import { Prisma, AccionAudit } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLogsQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";

export async function GET(req: Request) {
    try {
        // SPEC-571 (I-353): backstop de ROL además del módulo. `audit_logs` es
        // hoy mono-rol (ADMIN), así que esto no deja a nadie afuera; crea la
        // segunda capa para que, si el grant del módulo se ensancha, el acceso a
        // los logs de auditoría no se abra sin control de rol (API y página).
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "audit_logs");
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(req.url);
        const parsedQuery = auditLogsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, accion, acciones, usuarioId, recursoId, q, fechaDesde, fechaHasta } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        const where: Prisma.AuditLogWhereInput = {};
        if (acciones && acciones.length > 0) {
            where.accion = { in: acciones as AccionAudit[] };
        } else if (accion) {
            where.accion = accion as AccionAudit;
        }
        if (usuarioId) where.usuarioId = usuarioId;
        if (recursoId) where.recursoId = recursoId;
        if (q) {
            where.usuario = {
                OR: [
                    { nombre: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                ],
            };
        }
        if (fechaDesde || fechaHasta) {
            where.creadoEn = {};
            if (fechaDesde) where.creadoEn.gte = new Date(fechaDesde);
            if (fechaHasta) where.creadoEn.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
        }

        // E-8: las lecturas viven en los repos; la ruta no toca prisma.
        const [items, total] = await new AuditLogRepository().findPaginadosConUsuario(where, { skip, take: pageSize });

        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
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