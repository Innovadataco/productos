import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { contarDenunciasFormales } from "@/lib/audit-nuevas-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/admin/estadisticas/denuncias-formales (SPEC-140, FR-008, US3).
 * Métrica de impacto "denuncias formales facilitadas": conteo AGREGADO de
 * eventos DENUNCIA_FORMAL_GENERADA (total y por mes, período `YYYY-MM`).
 * La respuesta es solo números — sin reporte_id ni usuario_id.
 */
export async function GET(request: Request) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "estadisticas");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const resultado = await contarDenunciasFormales();
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[DenunciasFormales] Error contando eventos de denuncia formal", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
