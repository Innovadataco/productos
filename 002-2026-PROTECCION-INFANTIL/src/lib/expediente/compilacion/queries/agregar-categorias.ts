/**
 * SPEC-234 (002-PI-134): agregado de categorías detectadas de un expediente.
 * Query SQL puro sobre EventoExpediente; nunca toca el texto original.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/dal/prisma.ts";
import type { DbClient } from "@/lib/dal/unit-of-work";

export interface CategoriaAgregada {
    categoria: string;
    totalEventos: number;
    confianzaPromedio: number | null;
}

export async function agregarCategoriasPorExpediente(
    expedienteId: string,
    client: DbClient = prisma
): Promise<CategoriaAgregada[]> {
    const rows = await client.$queryRaw<
        { categoria: string; totalEventos: number; confianzaPromedio: number | null }[]
    >`
        SELECT
            COALESCE("categoriaDetectada", 'SIN_CATEGORIA') AS categoria,
            COUNT(*)::int AS "totalEventos",
            AVG("confianzaClasificacion")::float AS "confianzaPromedio"
        FROM "EventoExpediente"
        WHERE "expedienteId" = ${expedienteId}
        GROUP BY "categoriaDetectada"
        ORDER BY "totalEventos" DESC, "categoria" ASC
    `;
    return rows.map((r) => ({
        categoria: r.categoria,
        totalEventos: r.totalEventos,
        confianzaPromedio: r.confianzaPromedio,
    }));
}
