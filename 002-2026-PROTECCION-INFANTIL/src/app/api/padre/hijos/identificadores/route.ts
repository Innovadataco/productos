import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { agregarIdentificador } from "@/lib/dal/services/hijos";
import { camposIdentificadorEntrada } from "@/lib/dal/services/hijos/identificador-schema";

// SPEC-325 (extensión) · agregar un identificador a un hijo YA creado. El DAL
// exige que el padre sea dueño del hijo (PII acceso-solo-dueño) y normaliza el
// valor (mecanismo compartido · candado 22).
// SPEC-721: agregar una cuenta a un hijo existente EXIGE plataforma (esquema compartido con el alta).
const createSchema = z.object({
    hijoId: z.string().min(1).max(100),
    ...camposIdentificadorEntrada,
});

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = createSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { hijoId, ...identificador } = parsed.data;
        const res = await agregarIdentificador(usuario.id, hijoId, identificador);
        return NextResponse.json(res, { status: res.yaExistia ? 200 : 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && /no encontrado/i.test(error.message)) {
            return NextResponse.json(
                { error: { message: "Hijo no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        logger.error("[HIJOS] Error agregando identificador:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
