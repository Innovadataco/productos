import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptParameter } from "@/lib/param-encryption";
import { AppError, ERROR_CODES } from "@/lib/errors";

type RouteContext = { params: Promise<{ clave: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        await assertModulo(await verifyAuth("ADMIN" as never), "configuracion_sistema");
        const rate = await checkRateLimit(request, "admin_read");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        const { clave } = await context.params;
        const param = await prisma.parametroSistema.findUnique({ where: { clave } });
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!param.esSecreto) {
            throw new AppError("Solo se pueden revelar parámetros secretos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (!param.valor) {
            return NextResponse.json({ valor: "" });
        }

        const valor = decryptParameter(param.valor);
        return NextResponse.json({ valor });
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
