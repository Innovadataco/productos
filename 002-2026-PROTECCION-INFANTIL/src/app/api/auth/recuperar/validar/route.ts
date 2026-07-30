import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { recuperarValidarQuerySchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // SPEC-125: esquema Zod también para query params.
        const parsed = recuperarValidarQuerySchema.safeParse({ token: searchParams.get("token") });
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Token requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-053: la búsqueda y comparación de tokens viven en el DAL; la ruta no toca prisma.
        const resultado = await new AutenticacionService().validarTokenRecuperacion(parsed.data.token);

        if (resultado.valido) {
            return NextResponse.json({ valido: true, email: resultado.email });
        }

        return NextResponse.json(
            { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
            { status: 400 }
        );
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
