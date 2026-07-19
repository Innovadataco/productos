import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportesRevisionQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR" && !esComiteRol(user.rol)) {
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
        const parsedQuery = reportesRevisionQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, estado, plataformaId, categoria, fechaDesde, fechaHasta, incluirEliminados, operadorId } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        const where: Prisma.ReporteWhereInput = {};
        if (!incluirEliminados) {
            where.eliminado = false;
        }

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
            if (fechaDesde) {
                const [year, month, day] = fechaDesde.split("-").map(Number);
                (where.creadoEn as Prisma.DateTimeFilter<"Reporte">).gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            }
            if (fechaHasta) {
                const [year, month, day] = fechaHasta.split("-").map(Number);
                (where.creadoEn as Prisma.DateTimeFilter<"Reporte">).lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
            }
        }

        // Un operador solo ve sus casos asignados. Un comité ve sus casos asignados. Un admin puede filtrar por operador.
        if (user.rol === "OPERADOR") {
            where.operadorId = user.id;
        } else if (user.rol === "COMITE_VALIDACION") {
            where.comiteId = user.id;
        } else if (operadorId) {
            where.operadorId = operadorId;
        }

        // SCHOOL_ADMIN solo ve recursos de su tenant.
        if (user.rol === "SCHOOL_ADMIN") {
            where.tenantId = user.tenantId ?? null;
        }

        const [reportes, total] = await Promise.all([
            prisma.reporte.findMany({
                where,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip,
                take: pageSize,
                select: {
                    id: true,
                    identificador: true,
                    numeroSeguimiento: true,
                    estado: true,
                    esAnonimo: true,
                    prioridadAlta: true,
                    keywordsDetectadas: true,
                    esRafaga: true,
                    eliminado: true,
                    motivoBaja: true,
                    notaBaja: true,
                    eliminadoEn: true,
                    creadoEn: true,
                    fechaIncidente: true,
                    ciudad: true,
                    pais: true,
                    operadorId: true,
                    comiteId: true,
                    operador: { select: { id: true, email: true, nombre: true } },
                    comite: { select: { id: true, email: true, nombre: true } },
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
