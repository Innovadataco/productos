/**
 * Códigos, límites y versión del validador de la salida de un modelo (fase E). El validador cierra en fallo y devuelve
 * TODOS los códigos que encuentra, en este orden; el registro (`resumen_ia.motivos`) guarda esta misma lista cerrada.
 * v2: lee la salida `salida-v2` (segmentos; los hechos citados son las refs) y ya no revisa la lista `hechos`.
 * v3: en el DIARIO el código escribe los obligatorios que el modelo no cita (`obligatorias.ts`); el modelo trae al menos una frase.
 * v4: SIMULACION lee `salida-v3` (`{frases, revisar}`) y se le agregan RANGO_CONTRADICE, PARA_REVISAR y ATRIBUCION (la atribución del
 * cambio a una acción, condición C2 de PI), con sus propios límites; los tres tipos de hoy no cambian de conducta.
 * Cambiar un control, una lista de patrones o un límite es otra versión del validador (`VERSION_VALIDADOR`).
 */
export const VERSION_VALIDADOR = "validador-v4";
export type VersionValidador = typeof VERSION_VALIDADOR;

export const CODIGOS_VALIDADOR = Object.freeze([
  "SALIDA_INVALIDA", "LONGITUD", "CIFRA_SUELTA", "CIFRA_EN_PALABRAS", "HECHO_DESCONOCIDO", "HECHO_NO_CITADO",
  "ETIQUETA_NO_COINCIDE", "DIRECCION_CONTRADICE", "RECOMENDACION", "PREDICCION", "TRATO", "IDIOMA", "FORMATO", "RENDER_CIFRA",
  // v4, solo SIMULACION. Van después de FORMATO (que trae la cita pegada): ATRIBUCION depende de que la cita pegada se rechace antes.
  "RANGO_CONTRADICE", "PARA_REVISAR", "ATRIBUCION",
] as const);
export type CodigoValidador = (typeof CODIGOS_VALIDADOR)[number];

/**
 * Límites de la salida, medidos sobre el texto ya renderizado (con las presentaciones del paquete) y en puntos de
 * código. No van en el esquema (`minLength` y `maxLength` rompen la gramática de Ollama): se validan al leer.
 */
export const LIMITES_SALIDA = Object.freeze({
  minFrases: 1,
  maxFrases: 6,
  maxLargoFrase: 280,
  maxLargoTotal: 1200,
  /** Una palabra más larga no es español: FORMATO (y acota el trabajo de los patrones por palabra). */
  maxLargoPalabra: 32,
} as const);

/** Los límites de SIMULACION (decisión 5 de la compuerta): hasta 4 frases y hasta 2 ítems de «Para revisar». */
export const LIMITES_SIMULACION = Object.freeze({ maxFrases: 4, maxRevisar: 2 } as const);

export const CODIGOS_ERROR_VALIDADOR = Object.freeze(["PAQUETE_NO_CONSTRUIDO"] as const);
export type CodigoErrorValidador = (typeof CODIGOS_ERROR_VALIDADOR)[number];

/** Un defecto del código (no de la salida del modelo): lanza, sin repetir datos. */
export class ErrorValidador extends Error {
  override readonly name = "ErrorValidador";
  constructor(readonly codigo: CodigoErrorValidador) {
    super(`Validador de la salida: ${codigo}.`);
  }
}
