/**
 * E-4 (002-PI-056): fuente ÚNICA de los modelos por defecto del motor de IA.
 * Es el ÚLTIMO eslabón de la cadena de configuración en cada sitio:
 * parámetro en BD (ParametroSistema) → variable de entorno → ESTE default.
 * Antes estaba el literal repetido en cada consumidor (sandbox,
 * backfills, parametros del pipeline, rutas admin).
 */

/** Modelo de clasificación por defecto del motor. */
export const MODELO_CLASIFICACION_DEFAULT = "ornith:9b";

/** Modelo de anonimización/PII por defecto (hoy sigue al de clasificación). */
export const MODELO_ANONIMIZACION_DEFAULT = MODELO_CLASIFICACION_DEFAULT;

/** Modelo de embeddings por defecto. */
export const MODELO_EMBEDDING_DEFAULT = "nomic-embed-text";
