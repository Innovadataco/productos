import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { incidentesInfraQuerySchema } from "@/lib/validators";

/**
 * GET /api/admin/monitoreo/incidentes (SPEC-171, Pilar B)
 * Historial paginado de incidentes de infraestructura (ABIERTO | RESUELTO),
 * más recientes primero. Paginación estándar { items, pagination }.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "estadisticas");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = incidentesInfraQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, estado } = parsedQuery.data;
        const where: Prisma.IncidenteInfraWhereInput = estado ? { estado } : {};

        const repo = new MonitoreoRepository();
        const { items, total } = await repo.incidentesPaginados(where, page, pageSize);

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
