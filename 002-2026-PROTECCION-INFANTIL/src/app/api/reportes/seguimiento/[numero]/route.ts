import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { numeroSeguimientoSchema } from "@/lib/validators";
import { ERROR_CODES } from "@/lib/errors";
import { ReporteQueryService } from "@/lib/dal/services/reporte-query";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ numero: string }> }
) {
    try {
        const rate = await checkRateLimit(request, "seguimiento");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas consultas. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { numero: rawNumero } = await params;
        const parsedNumero = numeroSeguimientoSchema.safeParse(rawNumero);
        if (!parsedNumero.success) {
            return NextResponse.json(
                { error: { message: "Número de seguimiento inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-053: la consulta y el mapeo a DTOs viven en el DAL; la ruta no toca prisma.
        const resultado = await new ReporteQueryService().seguimiento(parsedNumero.data);

        if (!resultado) {
            return NextResponse.json(
                { error: { message: "Número de seguimiento no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json(resultado);
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
