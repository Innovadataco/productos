import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { AnalisisRecomendacionesService } from "@/lib/dal/services/analisis-recomendaciones";
import {
    parsearFiltrosDesdeSearchParams,
    resolverFiltros,
} from "@/lib/analisis/filtros-historial";

/**
 * SPEC-227 (002-PI-128, FR-004): métricas de tuning del historial (tasa de
 * aplicación, tasa de ignorada, tasa de expirada sobre resueltas, tiempo
 * promedio de resolución) globales y por regla, para el conjunto filtrado.
 * Mismos guards y filtros que la lista (sin paginación).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "analisis_recomendaciones");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const filtrosQuery = parsearFiltrosDesdeSearchParams(searchParams);

        const metricas = await new AnalisisRecomendacionesService().metricas(
            resolverFiltros(filtrosQuery),
            { desde: filtrosQuery.desde, hasta: filtrosQuery.hasta }
        );
        return NextResponse.json(metricas);
    } catch (error) {
        return errorToResponse(error, "[ANALISIS/RECOMENDACIONES/METRICAS]");
    }
}
