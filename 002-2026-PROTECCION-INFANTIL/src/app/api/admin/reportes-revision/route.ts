import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportesRevisionQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
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

        const { page, pageSize, estado, plataformaId, categoria, fechaDesde, fechaHasta, incluirEliminados, operadorId, padre, q, orden } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        // SPEC-122: la bandeja excluye bajas lógicas salvo que se pidan explícitamente.
        const where: Prisma.ReporteWhereInput = incluirEliminados ? {} : whereReporteVigente();

        if (padre) {
            // N-2 (002-PI-056): filtro por padre (email o nombre del denunciante).
            where.usuario = {
                OR: [
                    { email: { contains: padre, mode: "insensitive" } },
                    { nombre: { contains: padre, mode: "insensitive" } },
                ],
            };
        }

        if (q) {
            where.OR = [
                { numeroSeguimiento: { contains: q, mode: "insensitive" } },
                { identificador: { contains: q, mode: "insensitive" } },
            ];
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

        // E-8: la bandeja vive en el repo (mismo select/orden/paginación); la ruta no toca prisma.
        const [reportes, total] = await new ReporteRepository().findBandejaRevision(where, { skip, take: pageSize }, orden);

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
