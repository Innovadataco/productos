import { prisma } from "@/lib/prisma";
import { getParametroSistema } from "@/lib/parametros";
import { anonimizarTexto } from "./anonimizador";
import { logger } from "@/lib/logger";

/**
 * Procesa un registro del dataset de entrenamiento cuya anonimización
 * falló previamente. Reintenta anonimizar el texto y, si tiene éxito,
 * actualiza el registro con el texto anonimizado y el flag correspondiente.
 *
 * Si el registro ya está anonimizado, finaliza sin hacer nada.
 * Si la anonimización sigue fallando, lanza un error para que pg-boss reintente.
 */
export async function procesarBackfillAnonimizacion(datasetId: string): Promise<void> {
    const registro = await prisma.datasetEntrenamiento.findUnique({
        where: { id: datasetId },
    });

    if (!registro) {
        logger.warn(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} no encontrado`);
        return;
    }

    if (registro.textoAnonimizado) {
        logger.info(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} ya está anonimizado`);
        return;
    }

    const paramModelo = await getParametroSistema("reportes.classification_model");
    const modelo = paramModelo?.valor || process.env.IA_MODEL_ANONIMIZACION || "ornith:9b";

    const resultado = await anonimizarTexto(modelo, registro.texto);

    await prisma.datasetEntrenamiento.update({
        where: { id: datasetId },
        data: {
            texto: resultado.textoAnonimizado,
            textoAnonimizado: true,
        },
    });

    logger.info(`[BACKFILL_ANONIMIZACION] Registro ${datasetId} anonimizado correctamente`);
}
