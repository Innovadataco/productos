import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { dispersionQuerySchema, parseQuery } from "@/lib/schemas/analisis-panel";
import { AnalisisPanelService } from "@/lib/dal/services/analisis-panel";

/**
 * SPEC-222 (002-PI-123, FR-007/FR-008): puntos de la matriz dinero-vs-valor
 * del período (X = monto neto USD de pagos AUTORIZADO, Y = `scoreTotal` del
 * snapshot vigente) con cuadrante calculado. Cortes por parámetros
 * `analisis.panel.umbral_*` o mediana del dataset; límite de puntos
 * parametrizable (default 500, truncado determinístico por suscripcionId).
 */
export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "estadisticas");
        if (String(user.rol) !== "ADMIN") {
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

        const query = parseQuery(req, dispersionQuerySchema);
        // SPEC-053: las agregaciones viven en el DAL; la ruta no toca prisma.
        const resultado = await new AnalisisPanelService().dispersion(query);
        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[ADMIN/ANALISIS/DISPERSION]");
    }
}
