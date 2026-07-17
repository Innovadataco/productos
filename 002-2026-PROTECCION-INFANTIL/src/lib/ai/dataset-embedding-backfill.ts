import { prisma } from "@/lib/prisma";
import { generarEmbedding } from "./embedder";

async function getEmbeddingModel(): Promise<string> {
    const param = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.embedding_model" } });
    return param?.valor || process.env.IA_MODEL_EMBEDDING || "nomic-embed-text";
}

/**
 * Procesa un registro del dataset de entrenamiento cuyo embedding
 * no se pudo calcular en el momento de la corrección.
 *
 * - Si el registro no existe, finaliza sin error.
 * - Si ya tiene embedding, finaliza sin error.
 * - Si el embedding sigue fallando, lanza error para que pg-boss reintente.
 */
export async function procesarBackfillEmbedding(datasetId: string): Promise<void> {
    const registro = await prisma.datasetEntrenamiento.findUnique({
        where: { id: datasetId },
        include: { embedding: true },
    });

    if (!registro) {
        console.warn(`[BACKFILL_EMBEDDING] Registro ${datasetId} no encontrado`);
        return;
    }

    if (registro.embedding) {
        console.log(`[BACKFILL_EMBEDDING] Registro ${datasetId} ya tiene embedding`);
        return;
    }

    const modeloEmbedding = await getEmbeddingModel();
    const vector = await generarEmbedding(modeloEmbedding, registro.texto);
    const vectorStr = "[" + vector.join(",") + "]";

    await prisma.$executeRaw`
        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${datasetId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
    `;

    console.log(`[BACKFILL_EMBEDDING] Registro ${datasetId} embedding generado correctamente`);
}
