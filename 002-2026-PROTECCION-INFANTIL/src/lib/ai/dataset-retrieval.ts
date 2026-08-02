import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";

export interface EjemploRecuperado {
    datasetId: string;
    texto: string;
    categoria: string;
    similitud: number;
}

export interface RetrievalOptions {
    topK?: number;
    umbral?: number;
    excluirSimilitudMayorA?: number;
}

/**
 * Recupera ejemplos del dataset de entrenamiento cercanos en el espacio de embeddings.
 *
 * - topK: cantidad máxima de ejemplos a devolver (default 3).
 * - umbral: similitud coseno mínima para incluir un ejemplo (default 0.75).
 * - excluirSimilitudMayorA: descarta ejemplos con similitud > este valor para evitar
 *   leakage en modo eval (default 0.98).
 */
export async function buscarEjemplosSimilares(
    embedding: number[],
    options: RetrievalOptions = {}
): Promise<EjemploRecuperado[]> {
    const { topK = 3, umbral = 0.75, excluirSimilitudMayorA = 0.98 } = options;

    // E-8 (D3): la raw de pgvector vive en el adaptador EmbeddingRepository.
    const rows = await new EmbeddingRepository().buscarEjemplosSimilaresDataset(embedding, { topK, umbral });

    return rows
        .filter((r) => r.similitud <= excluirSimilitudMayorA)
        .map((r) => ({
            datasetId: r.id,
            texto: r.texto,
            categoria: r.clasificacionCorrecta,
            similitud: r.similitud,
        }));
}
