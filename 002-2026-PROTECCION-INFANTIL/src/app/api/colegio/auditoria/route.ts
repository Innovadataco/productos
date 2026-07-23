import { NextResponse } from "next/server";
import { Prisma, AccionAudit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { COLEGIO_AUDIT_ACTIONS } from "@/lib/audit-actions";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { auditLogsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/colegio/auditoria
 * Auditoría del colegio para SCHOOL_ADMIN: solo acciones COLEGIO_* y solo del
 * colegio del usuario autenticado (aislamiento estricto por colegioId).
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            throw new AppError("El usuario no está asociado a un colegio", ERROR_CODES.FORBIDDEN, 403);
        }

        const url = new URL(request.url);
        const parsedQuery = auditLogsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, accion, acciones, recursoId, q, fechaDesde, fechaHasta } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        // Aislamiento: siempre restringido al colegio del usuario y a acciones COLEGIO_*.
        const where: Prisma.AuditLogWhereInput = {
            colegioId: user.colegioId,
        };
        if (acciones && acciones.length > 0) {
            const solicitadas = (acciones as AccionAudit[]).filter((a) => COLEGIO_AUDIT_ACTIONS.includes(a));
            where.accion = { in: solicitadas.length > 0 ? solicitadas : COLEGIO_AUDIT_ACTIONS };
        } else if (accion) {
            where.accion = COLEGIO_AUDIT_ACTIONS.includes(accion as AccionAudit)
                ? (accion as AccionAudit)
                : { in: COLEGIO_AUDIT_ACTIONS };
        } else {
            where.accion = { in: COLEGIO_AUDIT_ACTIONS };
        }
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
