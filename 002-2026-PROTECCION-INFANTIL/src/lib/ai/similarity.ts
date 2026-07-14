import { prisma } from "@/lib/prisma";

export interface SimilarityResult {
    reporteId: string;
    similarity: number;
}

/**
 * Busca el reporte más similar por embedding para el mismo identificador + plataforma.
 * Excluye reportes marcados como DUPLICADO o POSIBLE_SPAM y el reporte actual.
 * Usa distancia coseno: 1 - distance = cosine similarity.
 */
export async function buscarReporteSimilar(
    reporteId: string,
    identificador: string,
    plataformaId: string,
    embedding: number[],
    threshold: number
): Promise<SimilarityResult | null> {
    const vectorStr = "[" + embedding.join(",") + "]";

    const result = await prisma.$queryRaw<{ reporteId: string; similarity: number }[]>`
        SELECT e."reporteId", 1 - (e.vector <=> ${vectorStr}::vector) AS similarity
        FROM "EmbeddingReporte" e
        JOIN "Reporte" r ON r.id = e."reporteId"
        WHERE r.identificador = ${identificador}
          AND r."plataformaId" = ${plataformaId}
          AND r.estado NOT IN ('DUPLICADO', 'POSIBLE_SPAM')
          AND r.id != ${reporteId}
          AND 1 - (e.vector <=> ${vectorStr}::vector) >= ${threshold}
        ORDER BY similarity DESC
        LIMIT 1
    `;

    return result[0] || null;
}
