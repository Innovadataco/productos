import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol } from "@/lib/operadores/permisos";
import { EstadisticasService } from "@/lib/dal/services/estadisticas";
import { cuidIdSchema } from "@/lib/schemas/base";

const querySchema = z.object({
    fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // SPEC-444 (I-310): Usuario.id es cuid(); uuid() nunca dejaba filtrar por operador.
    operadorId: cuidIdSchema.optional(),
    estado: z.enum(["REVISION_MANUAL", "CLASIFICADO", "CORREGIDO", "REPORTE_FALSO"]).optional(),
    categoria: z.string().optional(),
    busqueda: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "estadisticas");
        if (!esAdminRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(req.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        // SPEC-053: indicadores, métricas por operador y tabla viven en el DAL;
        // la ruta no toca prisma.
        const resultado = await new EstadisticasService().clasificacion(parsed.data);

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
