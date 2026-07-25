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

/**
 * Similitud máxima contra reportes del mismo identificador + plataforma, sin filtro de
 * umbral. Sirve para la traza del expediente (spec 096): registrar el score aunque no
 * supere el umbral de duplicado. Devuelve null si no hay otros reportes con embedding.
 */
export async function buscarSimilitudMaxima(
    reporteId: string,
    identificador: string,
    plataformaId: string,
    embedding: number[]
): Promise<number | null> {
    const vectorStr = "[" + embedding.join(",") + "]";

    const result = await prisma.$queryRaw<{ similarity: number }[]>`
        SELECT 1 - (e.vector <=> ${vectorStr}::vector) AS similarity
        FROM "EmbeddingReporte" e
        JOIN "Reporte" r ON r.id = e."reporteId"
        WHERE r.identificador = ${identificador}
          AND r."plataformaId" = ${plataformaId}
          AND r.estado NOT IN ('DUPLICADO', 'POSIBLE_SPAM')
          AND r.id != ${reporteId}
        ORDER BY e.vector <=> ${vectorStr}::vector ASC
        LIMIT 1
    `;

    return result[0]?.similarity ?? null;
}
