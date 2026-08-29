import { getParametroSistema } from "@/lib/parametros";
import { generarEmbedding } from "./embedder";
import { MODELO_EMBEDDING_DEFAULT } from "./defaults";
import { logger } from "@/lib/logger";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";

async function getEmbeddingModel(): Promise<string> {
    const param = await getParametroSistema("reportes.embedding_model");
    return param?.valor || process.env.IA_MODEL_EMBEDDING || MODELO_EMBEDDING_DEFAULT;
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
    // E-8: la lectura vive en el repo; la raw de pgvector en el adaptador (D3).
    const registro = await new DatasetEntrenamientoRepository().findByIdConEmbedding(datasetId);

    if (!registro) {
        logger.warn(`[BACKFILL_EMBEDDING] Registro ${datasetId} no encontrado`);
        return;
    }

    if (registro.embedding) {
        logger.info(`[BACKFILL_EMBEDDING] Registro ${datasetId} ya tiene embedding`);
        return;
    }

    const modeloEmbedding = await getEmbeddingModel();
    const vector = await generarEmbedding(modeloEmbedding, registro.texto);

    await new EmbeddingRepository().insertDatasetEmbedding(datasetId, modeloEmbedding, vector);

    logger.info(`[BACKFILL_EMBEDDING] Registro ${datasetId} embedding generado correctamente`);
}
