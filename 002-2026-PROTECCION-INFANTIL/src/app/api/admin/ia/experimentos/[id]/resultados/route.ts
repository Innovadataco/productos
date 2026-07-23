import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, type Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

const RESULTADOS_POR_PAGINA = 50;

export async function GET(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");
        const { id } = await context.params;

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const run = await prisma.evalRun.findUnique({ where: { id } });
        if (!run) {
            throw new AppError("Experimento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const { searchParams } = new URL(request.url);
        const categoria = searchParams.get("categoria") || undefined;
        const correctoRaw = searchParams.get("correcto");
        const correcto = correctoRaw === null ? undefined : correctoRaw === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

        const where: Prisma.EvalResultadoWhereInput = { experimentoId: id };
        if (categoria) where.esperado = categoria;
        if (correcto !== undefined) where.correcto = correcto;

        const [items, total] = await prisma.$transaction([
            prisma.evalResultado.findMany({
                where,
                orderBy: { creadoEn: "asc" },
                skip: (page - 1) * RESULTADOS_POR_PAGINA,
                take: RESULTADOS_POR_PAGINA,
                include: { casoEval: { select: { texto: true, ruido: true } } },
            }),
            prisma.evalResultado.count({ where }),
        ]);

        return NextResponse.json({
            items,
            pagination: { page, totalPages: Math.ceil(total / RESULTADOS_POR_PAGINA), total },
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
