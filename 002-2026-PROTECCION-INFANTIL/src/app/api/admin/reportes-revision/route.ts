import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;

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
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize") || "25")));
        const skip = (page - 1) * pageSize;

        const estado = url.searchParams.get("estado");
        const plataformaId = url.searchParams.get("plataformaId");
        const categoria = url.searchParams.get("categoria");
        const fechaDesde = url.searchParams.get("fechaDesde");
        const fechaHasta = url.searchParams.get("fechaHasta");

        const where: Prisma.ReporteWhereInput = {};

        if (estado) {
            where.estado = estado as Prisma.EnumEstadoReporteFilter<"Reporte">;
        }
        if (plataformaId) {
            where.plataformaId = plataformaId;
        }
        if (categoria) {
            where.clasificacion = { categoria: categoria as Prisma.EnumCategoriaConductaFilter<"ClasificacionIA"> };
        }
        if (fechaDesde || fechaHasta) {
            where.creadoEn = {};
            if (fechaDesde) (where.creadoEn as Prisma.DateTimeFilter<"Reporte">).gte = new Date(fechaDesde);
            if (fechaHasta) (where.creadoEn as Prisma.DateTimeFilter<"Reporte">).lte = new Date(fechaHasta);
        }

        const [reportes, total] = await Promise.all([
            prisma.reporte.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    identificador: true,
                    numeroSeguimiento: true,
                    estado: true,
                    esAnonimo: true,
                    creadoEn: true,
                    fechaIncidente: true,
                    ciudad: true,
                    pais: true,
                    plataforma: { select: { id: true, nombre: true, clave: true } },
                    clasificacion: {
                        include: {
                            correccion: {
                                select: {
                                    categoriaOriginal: true,
                                    categoriaCorregida: true,
                                    motivo: true,
                                    creadoEn: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.reporte.count({ where }),
        ]);

        return NextResponse.json({
            reportes,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
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
