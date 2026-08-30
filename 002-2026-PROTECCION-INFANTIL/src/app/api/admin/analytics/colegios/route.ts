import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { analyticsColegiosQuerySchema } from "@/lib/validators";
import { cacheKey, getCache, setCache, ttlDesdeMinutos } from "@/lib/analytics/cache";
import { cargarParametrosAnalytics } from "@/lib/analytics/parametros";
import { AnalyticsColegioRepository } from "@/lib/dal/repositories/analytics-colegio";

/**
 * GET /api/admin/analytics/colegios (SPEC-194, 002-PI-088)
 * Resumen paginado de analítica por colegio. Usa caché en memoria con TTL configurable.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "analytics_colegios");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = analyticsColegiosQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q, ciudadId, estado, orden, direccion } = parsedQuery.data;
        const params = await cargarParametrosAnalytics();
        const cacheK = cacheKey(
            "analytics:colegios:resumen",
            page,
            pageSize,
            q,
            ciudadId,
            estado,
            orden,
            direccion
        );

        const cached = getCache<{ items: unknown[]; pagination: unknown }>(cacheK);
        if (cached) {
            return NextResponse.json(cached);
        }

        const { items, total } = await new AnalyticsColegioRepository().resumenColegios(
            { q, ciudadId, estado, orden, direccion },
            { skip: (page - 1) * pageSize, take: pageSize }
        );

        // SPEC-303 (002-PI-209): añade `umbralesSemaforo` al top-level del payload para que
        // el frontend renderice la leyenda del semáforo con los umbrales vigentes (I-104).
        const response = {
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
            umbralesSemaforo: {
                casosAbiertosAlto: params.casosAbiertosAlto,
                casosSinMovimientoDias: params.casosSinMovimientoDias,
                porcentajeProcesadoMin: params.porcentajeProcesadoMin,
                inactividadAlertaDias: params.inactividadAlertaDias,
                spamAlertaPct: params.spamAlertaPct,
                resolucionComiteOkPct: params.resolucionComiteOkPct,
                periodoDefaultDias: params.periodoDefaultDias,
            },
        };

        setCache(cacheK, response, ttlDesdeMinutos(params.cacheTtlMin));
        return NextResponse.json(response);
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
