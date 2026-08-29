import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPageSize, clampPage } from "@/lib/pagination";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "dataset_entrenamiento");
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"));
        const skip = (page - 1) * pageSize;

        // Regla dura: los consumidores del dataset solo pueden acceder a registros
        // cuyo texto haya sido anonimizado. El conteo total sigue visible para
        // métricas de cobertura, pero el listado filtra los no anonimizados.
        // E-8: las consultas viven en el repo; la ruta no toca prisma.
        const repo = new DatasetEntrenamientoRepository();
        const [items, total, anonimizados] = await Promise.all([
            repo.listarAnonimizadosPaginados({ skip, take: pageSize }),
            repo.contarTodos(),
            repo.contarAnonimizados(),
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
