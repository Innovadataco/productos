import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";

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
    // E-8 (D3): la raw de pgvector vive en el adaptador EmbeddingRepository.
    return new EmbeddingRepository().buscarReporteSimilarPorEmbedding(embedding, {
        reporteId,
        identificador,
        plataformaId,
        threshold,
    });
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
    // E-8 (D3): la raw de pgvector vive en el adaptador EmbeddingRepository.
    return new EmbeddingRepository().buscarSimilitudMaximaPorEmbedding(embedding, {
        reporteId,
        identificador,
        plataformaId,
    });
}
