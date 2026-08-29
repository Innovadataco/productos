import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ApelacionService } from "@/lib/dal/services/apelaciones";

/**
 * SPEC-110 — Lista de apelaciones del usuario autenticado.
 *
 * Regla dura: el apelante NO ve contenido de ningún reporte. La respuesta incluye
 * únicamente `numeroReportesAsociados` (N) como dato derivado de los reportes:
 * nunca texto, fechas, plataforma ni estados de los reportes.
 */

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();

        const rate = await checkRateLimit(request, "apelacion", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize } = parsedQuery.data;

        // SPEC-053: la consulta y el mapeo (sin contenido de reportes) viven en el DAL;
        // la ruta no toca prisma.
        const resultado = await new ApelacionService().mias(user.id, page, pageSize);

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[Apelaciones] Error listando propias:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
