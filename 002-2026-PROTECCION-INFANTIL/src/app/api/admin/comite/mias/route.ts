import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esComiteRol } from "@/lib/operadores/permisos";
import { z } from "zod";

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        if (!esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Requiere rol COMITE_VALIDACION", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, limit } = parsedQuery.data;
        const skip = (page - 1) * limit;

        const where = { comiteId: user.id, estado: { in: ["PENDIENTE", "ASIGNADA"] } };
        const [solicitudes, total] = await Promise.all([
            prisma.solicitudComite.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    numero: true,
                    reporteId: true,
                    estado: true,
                    motivo: true,
                    creadoEn: true,
                    comiteId: true,
                },
            }),
            prisma.solicitudComite.count({ where }),
        ]);

        return NextResponse.json({
            solicitudes,
            paginacion: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
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
