import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
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

        const url = new URL(req.url);
        const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "25")));
        const skip = (page - 1) * pageSize;

        const accion = url.searchParams.get("accion");
        const usuarioId = url.searchParams.get("usuarioId");
        const fechaDesde = url.searchParams.get("fechaDesde");
        const fechaHasta = url.searchParams.get("fechaHasta");

        const where: Record<string, unknown> = {};
        if (accion) where.accion = accion;
        if (usuarioId) where.usuarioId = usuarioId;
        if (fechaDesde || fechaHasta) {
            where.creadoEn = {};
            if (fechaDesde) (where.creadoEn as Record<string, unknown>).gte = new Date(fechaDesde);
            if (fechaHasta) (where.creadoEn as Record<string, unknown>).lte = new Date(fechaHasta);
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