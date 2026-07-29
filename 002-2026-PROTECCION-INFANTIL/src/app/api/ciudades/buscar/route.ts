import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizarNombreGeografico } from "@/lib/normalizar";

const buscarSchema = z.object({
    q: z.string().min(2).max(100),
    paisId: z.string().min(1),
    departamentoId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

type CiudadBusqueda = {
    id: string;
    nombre: string;
    paisId: string;
    departamentoId: string | null;
    departamento: string | null;
    lat: number | null;
    lng: number | null;
};

/**
 * GET /api/ciudades/buscar?q=...&paisId=...&departamentoId=...&limit=20
 *
 * SPEC-115: búsqueda de ciudades en el SERVIDOR (nada de cargar el catálogo al
 * navegador). Pública (el wizard de reporte es anónimo), con rate-limit
 * (scope `ciudades_buscar`) y validación Zod. Busca sobre `nombreNormalizado`
 * (sin tildes, minúsculas) con índice GIN pg_trgm; ordena prefijo primero y
 * luego por población descendente. Devuelve como mucho `limit` resultados.
 */
export async function GET(request: Request) {
    const rate = await checkRateLimit(request, "ciudades_buscar");
    if (!rate.allowed) {
        return NextResponse.json(
            {
                error: {
                    message: "Demasiadas búsquedas. Intenta más tarde.",
                    code: ERROR_CODES.RATE_LIMITED,
                    retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000),
                },
            },
            { status: 429, headers: rate.headers }
        );
    }

    const { searchParams } = new URL(request.url);
    const parsed = buscarSchema.safeParse({
        q: searchParams.get("q") ?? "",
        paisId: searchParams.get("paisId") ?? "",
        departamentoId: searchParams.get("departamentoId") || undefined,
        limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return NextResponse.json(
            { error: { message: "Parámetros de búsqueda inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
            { status: 400 }
        );
    }

    const { q, paisId, departamentoId, limit } = parsed.data;
    const qNorm = normalizarNombreGeografico(q);
    if (qNorm.length < 2) {
        return NextResponse.json({ ciudades: [] });
    }
    const contiene = `%${qNorm}%`;
    const prefijo = `${qNorm}%`;

    try {
        const ciudades = await prisma.$queryRaw<CiudadBusqueda[]>`
            SELECT c.id, c.nombre, c."paisId", c."departamentoId",
                   d.nombre AS departamento, c.lat, c.lng
            FROM "Ciudad" c
            LEFT JOIN "Departamento" d ON d.id = c."departamentoId"
            WHERE c."paisId" = ${paisId}
              AND c."esActivo" = true
              AND c."nombreNormalizado" ILIKE ${contiene}
              ${departamentoId ? Prisma.sql`AND c."departamentoId" = ${departamentoId}` : Prisma.empty}
            ORDER BY (c."nombreNormalizado" LIKE ${prefijo}) DESC,
                     c.poblacion DESC NULLS LAST,
                     c.nombre ASC
            LIMIT ${limit}
        `;
        return NextResponse.json({ ciudades }, { headers: rate.headers });
    } catch (error) {
        logger.error("[Ciudades] Error en búsqueda:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
