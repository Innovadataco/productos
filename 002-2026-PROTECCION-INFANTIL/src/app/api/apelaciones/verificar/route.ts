import { NextResponse } from "next/server";
import { verificarOtpApelacion } from "@/lib/apelaciones";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
    token: z.string().min(1),
    codigo: z.string().length(6),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const rate = await checkRateLimit(request, "apelacion_sms", { identifier: parsed.data.token });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos de verificación. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        await verificarOtpApelacion(parsed.data.token, parsed.data.codigo);
        return NextResponse.json({ verificado: true });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "TOKEN_INVALIDO") {
            return NextResponse.json({ error: { message: "Enlace inválido", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }
        if (msg === "YA_VERIFICADO") {
            return NextResponse.json({ error: { message: "Ya verificado", code: ERROR_CODES.CONFLICT } }, { status: 409 });
        }
        if (msg === "DEMASIADOS_INTENTOS" || msg === "CODIGO_INVALIDO") {
            return NextResponse.json({ error: { message: "Código incorrecto", code: ERROR_CODES.VALIDATION_ERROR } }, { status: 400 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
