import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, Number(searchParams.get("page") || "1"));
        const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "25")));
        const skip = (page - 1) * pageSize;

        // Regla dura: los consumidores del dataset solo pueden acceder a registros
        // cuyo texto haya sido anonimizado. El conteo total sigue visible para
        // métricas de cobertura, pero el listado filtra los no anonimizados.
        const [items, total, anonimizados] = await Promise.all([
            prisma.datasetEntrenamiento.findMany({
                where: { textoAnonimizado: true },
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                include: {
                    correccion: {
                        select: {
                            categoriaOriginal: true,
                            categoriaCorregida: true,
                        },
                    },
                },
            }),
            prisma.datasetEntrenamiento.count(),
            prisma.datasetEntrenamiento.count({ where: { textoAnonimizado: true } }),
        ]);

        return NextResponse.json({
            items,
            total,
            anonimizados,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
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
