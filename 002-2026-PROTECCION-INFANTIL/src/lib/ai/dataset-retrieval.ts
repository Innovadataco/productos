import { prisma } from "@/lib/prisma";

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
    const vectorStr = "[" + embedding.join(",") + "]";

    const rows = await prisma.$queryRaw<
        { id: string; texto: string; clasificacionCorrecta: string; similitud: number }[]
    >`
        SELECT d.id, d.texto, d."clasificacionCorrecta", 1 - (e.vector <=> ${vectorStr}::vector) AS similitud
        FROM "DatasetEntrenamiento" d
        JOIN "EmbeddingDataset" e ON e."datasetId" = d.id
        WHERE 1 - (e.vector <=> ${vectorStr}::vector) >= ${umbral}
        ORDER BY e.vector <=> ${vectorStr}::vector ASC
        LIMIT ${topK}
    `;

    return rows
        .filter((r) => r.similitud <= excluirSimilitudMayorA)
        .map((r) => ({
            datasetId: r.id,
            texto: r.texto,
            categoria: r.clasificacionCorrecta,
            similitud: r.similitud,
        }));
}
