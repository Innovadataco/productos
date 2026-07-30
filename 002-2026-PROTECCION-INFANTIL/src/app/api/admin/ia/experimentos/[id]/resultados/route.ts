import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { IaEvalsService } from "@/lib/dal/services/ia-evals";
import { RolUsuario } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = { params: Promise<{ id: string }> };

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

        const { searchParams } = new URL(request.url);
        const categoria = searchParams.get("categoria") || undefined;
        const correctoRaw = searchParams.get("correcto");
        const correcto = correctoRaw === null ? undefined : correctoRaw === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

        // SPEC-053: existencia del experimento, filtros y paginación viven en el DAL.
        const resultado = await new IaEvalsService().listarResultadosExperimento(id, { categoria, correcto, page });

        return NextResponse.json(resultado);
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
