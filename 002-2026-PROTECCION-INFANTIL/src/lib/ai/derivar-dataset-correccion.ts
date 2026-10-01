import { logger } from "@/lib/logger";
import { anonimizarTexto } from "./anonimizador";
import { generarEmbedding } from "./embedder";
import { MODELO_ANONIMIZACION_DEFAULT, MODELO_EMBEDDING_DEFAULT } from "./defaults";
import { publishDatasetEmbeddingBackfill } from "@/lib/queue";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";
import type { CategoriaConducta } from "@prisma/client";

export interface DerivarDatasetParams {
    /** Texto de TRABAJO del reporte (ya en memoria del handler; nunca viaja por cola ni BuzónJob). */
    textoTrabajo: string;
    /** Texto ORIGINAL descifrado en la petición (bajo el actor). Solo para inferir `yaAnonimizado`. */
    textoOriginalPlano: string;
    categoriaCorregida: CategoriaConducta;
    correccionId: string;
}

/**
 * SPEC-807 · Deriva la copia de entrenamiento (dataset) de una corrección: anonimiza (si hace falta),
 * persiste SOLO anonimizada, y genera el embedding. Toca Ollama, que es REMOTO (Tailscale) y puede
 * estar dormido: el fetch estructurado se CUELGA hasta el timeout (hoy 120 s en prod; default del
 * código bajado a 60 s). Por eso este trabajo es BEST-EFFORT y corre FUERA de la petición
 * (`enSegundoPlano`): si se awaitara en el handler, el bloqueo haría que el cliente ABORTE la petición
 * —ese abort es uno de los productores del `uncaughtException: Error: aborted` ECONNRESET que vive en
 * su propia SPEC (810)—. Sacarlo de la petición quita ese productor.
 *
 * PRIVACIDAD (candado preexistente, se conserva): si la anonimización FALLA, NO se guarda copia. Un
 * relato en claro NUNCA entra al dataset — se pierde el ejemplo antes que guardar crudo.
 *
 * ⚠️ OBSERVACIÓN DEL TRABAJO (deuda DECLARADA — fuera del alcance de 807, a radicar aparte): al correr
 * fuera de la petición, si Ollama está caído NADIE sabe QUÉ correcciones quedaron sin dataset. El
 * monitor de `monitoreo.ollama.*` observa a la DEPENDENCIA (Ollama arriba/abajo), no al TRABAJO. Para
 * cerrar esto haría falta una marca de pendiente por unidad —p. ej. `Correccion.datasetDerivadoEn`
 * (nullable) o una cola dedicada— + un conteo de «correcciones sin dataset» que un monitor pueda leer.
 */
export async function derivarDatasetDeCorreccion(p: DerivarDatasetParams): Promise<void> {
    // Si el texto de trabajo ya divergió del original, ya viene anonimizado del flujo de procesamiento
    // (S-C · D-116/D-117). Si no, se anonimiza SIEMPRE antes de guardar. Si FALLA, no se guarda copia.
    const yaAnonimizado = p.textoTrabajo !== p.textoOriginalPlano;
    let textoDataset: string | null = null;
    try {
        if (yaAnonimizado) {
            textoDataset = p.textoTrabajo;
        } else {
            const paramModelo = await new ParametroRepository().findByClave("reportes.classification_model");
            const modelo = paramModelo?.valor || process.env.IA_MODEL_ANONIMIZACION || MODELO_ANONIMIZACION_DEFAULT;
            const resultado = await anonimizarTexto(modelo, p.textoTrabajo);
            textoDataset = resultado.textoAnonimizado;
        }
    } catch (err) {
        logger.error("[CORRECCION] Falló la anonimización del dataset; NO se guarda la copia (nunca un relato en claro). Reintento futuro desde el sobre del reporte:", err);
        textoDataset = null;
    }

    // Solo se persiste si quedó anonimizada. textoAnonimizado es SIEMPRE true: no existe la fila cruda.
    if (textoDataset === null) return;

    const datasetRegistro = await new DatasetEntrenamientoRepository().crear({
        texto: textoDataset,
        clasificacionCorrecta: p.categoriaCorregida,
        fuente: "correccion_admin",
        correccionId: p.correccionId,
        textoAnonimizado: true,
    });

    // Embedding para RAG (F5). Si falla, se encola backfill (observado por la cola).
    try {
        const paramEmbedding = await new ParametroRepository().findByClave("reportes.embedding_model");
        const modeloEmbedding = paramEmbedding?.valor || MODELO_EMBEDDING_DEFAULT;
        const vector = await generarEmbedding(modeloEmbedding, datasetRegistro.texto);
        await new EmbeddingRepository().insertDatasetEmbedding(datasetRegistro.id, modeloEmbedding, vector);
    } catch (embedErr) {
        logger.error("[CORRECCION] Fallo embedding para dataset, encolando backfill:", embedErr);
        try {
            await publishDatasetEmbeddingBackfill(datasetRegistro.id);
        } catch (queueErr) {
            logger.error("[CORRECCION] No se pudo encolar backfill de embedding:", queueErr);
        }
    }
}
