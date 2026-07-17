import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLogsQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
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

        const { page, pageSize, accion, usuarioId, fechaDesde, fechaHasta } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        const where: Record<string, unknown> = {};
        if (accion) where.accion = accion;
        if (usuarioId) where.usuarioId = usuarioId;
        if (fechaDesde || fechaHasta) {
            where.creadoEn = {};
            if (fechaDesde) (where.creadoEn as Record<string, unknown>).gte = new Date(fechaDesde);
            if (fechaHasta) (where.creadoEn as Record<string, unknown>).lte = new Date(fechaHasta + "T23:59:59.999Z");
        }

        const [items, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                include: { usuario: { select: { nombre: true, email: true } } },
            }),
            prisma.auditLog.count({ where }),
        ]);

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