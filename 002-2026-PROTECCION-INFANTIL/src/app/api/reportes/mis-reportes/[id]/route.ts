import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ReporteQueryService } from "@/lib/dal/services/reporte-query";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/reportes/mis-reportes/[id] — detalle PRIVADO del reporte (spec 090, US3;
 * contrato rehecho en spec 116). Solo el dueño (PARENT autenticado) puede verlo.
 *
 * El padre ve SOLO tres cosas: las conductas CONFIRMADAS (las que superaron el
 * umbral en el motor — la traza de votos ya no se lee aquí), qué significan
 * (plantilla determinista D-23, nunca salida cruda del modelo) y, en la UI, los
 * canales oficiales. La traza técnica completa (modelos, votos, porcentajes,
 * umbrales, categorías descartadas) es superficie del admin (D-22): vive en el
 * expediente de spec 096 y NUNCA sale por este endpoint.
 */
export async function GET(_request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth("PARENT");
        // SPEC-356 (I-253) · DEROGADO el guard de vigencia de SPEC-119 acá,
        // por la misma razón que en el listado: `/api/reportes` está exenta en
        // `guardias.ts` por la regla dura de Jelkin, y el detalle de un reporte
        // propio es parte de seguir el hilo de lo denunciado. NO reintroducir.
        const { id } = await context.params;

        // SPEC-053: la consulta y el mapeo a DTOs viven en el DAL; la ruta no toca prisma.
        const resultado = await new ReporteQueryService().detallePadre(id, user.id);

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
