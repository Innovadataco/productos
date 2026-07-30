import { NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarValidarSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

export async function POST(request: Request) {
    try {
        // SPEC-125: esquema Zod; el mensaje es contrato del frontend (registro/page.tsx).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = verificarValidarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email y código de 6 dígitos requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { email, codigo } = parsed.data;

        // SPEC-053: búsqueda, comparación y marcado del código viven en el DAL;
        // la ruta no toca prisma.
        const resultado = await new AutenticacionService().validarCodigo(email, codigo);

        if (!resultado.ok) {
            if (resultado.tipo === "max_intentos") {
                return NextResponse.json(
                    { error: { message: "Máximo de intentos excedido", code: ERROR_CODES.AUTH_INVALID } },
                    { status: 400 }
                );
            }
            if (resultado.tipo === "incorrecto") {
                return NextResponse.json(
                    { error: { message: "Código incorrecto", code: ERROR_CODES.AUTH_INVALID } },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: { message: "Código inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        const tempToken = await createToken({
            sub: email,
            type: "verification",
            exp: Math.floor(Date.now() / 1000) + 15 * 60,
        });

        return NextResponse.json({ valido: true, token: tempToken });
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
