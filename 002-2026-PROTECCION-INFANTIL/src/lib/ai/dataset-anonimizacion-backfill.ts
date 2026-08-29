import { getParametroSistema } from "@/lib/parametros";
import { anonimizarTexto } from "./anonimizador";
import { MODELO_ANONIMIZACION_DEFAULT } from "./defaults";
import { logger } from "@/lib/logger";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";

/**
 * Procesa un registro del dataset de entrenamiento cuya anonimización
 * falló previamente. Reintenta anonimizar el texto y, si tiene éxito,
 * actualiza el registro con el texto anonimizado y el flag correspondiente.
 *
 * Si el registro ya está anonimizado, finaliza sin hacer nada.
 * Si la anonimización sigue fallando, lanza un error para que pg-boss reintente.
 */
export async function procesarBackfillAnonimizacion(datasetId: string): Promise<void> {
    // E-8: las lecturas/escrituras viven en el repo; la lógica no cambia.
    const registro = await new DatasetEntrenamientoRepository().findById(datasetId);

    if (!registro) {
        logger.warn(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} no encontrado`);
        return;
    }

    if (registro.textoAnonimizado) {
        logger.info(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} ya está anonimizado`);
        return;
    }

    const paramModelo = await getParametroSistema("reportes.classification_model");
    const modelo = paramModelo?.valor || process.env.IA_MODEL_ANONIMIZACION || MODELO_ANONIMIZACION_DEFAULT;

    const resultado = await anonimizarTexto(modelo, registro.texto);

    await new DatasetEntrenamientoRepository().marcarAnonimizado(datasetId, resultado.textoAnonimizado);

    logger.info(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} anonimizado correctamente`);
}
