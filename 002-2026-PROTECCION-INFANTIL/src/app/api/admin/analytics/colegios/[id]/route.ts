import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { cacheKey, getCache, setCache, ttlDesdeMinutos } from "@/lib/analytics/cache";
import { cargarParametrosAnalytics } from "@/lib/analytics/parametros";
import { AnalyticsColegioRepository } from "@/lib/dal/repositories/analytics-colegio";

/**
 * GET /api/admin/analytics/colegios/[id] (SPEC-194, 002-PI-088)
 * Ficha detalle de un colegio con 7 secciones analíticas. Caché por colegioId.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "analytics_colegios");
        const rate = await checkRateLimit(_request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const parsedId = idSchema.safeParse(id);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const paramsAnalytics = await cargarParametrosAnalytics();
        const cacheK = cacheKey("analytics:colegios:detalle", parsedId.data);
        const cached = getCache<unknown>(cacheK);
        if (cached) {
            return NextResponse.json(cached);
        }

        const detalle = await new AnalyticsColegioRepository().detalleColegio(parsedId.data);
        if (!detalle) {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        setCache(cacheK, detalle, ttlDesdeMinutos(paramsAnalytics.cacheTtlMin));
        return NextResponse.json(detalle);
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
