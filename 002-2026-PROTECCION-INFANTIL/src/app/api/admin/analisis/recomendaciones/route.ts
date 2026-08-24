import { NextResponse } from "next/server";
import { z } from "zod";
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
 * SPEC-227 (002-PI-128, FR-001/002/003): historial de sugerencias del motor de
 * reglas — lista paginada con filtros. Solo lectura (la resolución vive en
 * SPEC-221/226). Guards: verifyAuth(ADMIN) + módulo `analisis_recomendaciones`
 * + rate limit `admin_read`.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const paginacionSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

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
        const paginacion = paginacionSchema.parse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
        });

        const resultado = await new AnalisisRecomendacionesService().listar(
            resolverFiltros(filtrosQuery),
            paginacion.page,
            paginacion.pageSize
        );
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ANALISIS/RECOMENDACIONES]");
    }
}
