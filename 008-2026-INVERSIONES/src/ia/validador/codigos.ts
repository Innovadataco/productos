/**
 * Códigos, límites y versión del validador de la salida de un modelo (fase E). El validador cierra en fallo y devuelve
 * TODOS los códigos que encuentra, en este orden; el registro (`resumen_ia.motivos`) guarda esta misma lista cerrada.
 * Cambiar un control, una lista de patrones o un límite es otra versión del validador (`VERSION_VALIDADOR`).
 */
export const VERSION_VALIDADOR = "validador-v1";
export type VersionValidador = typeof VERSION_VALIDADOR;

export const CODIGOS_VALIDADOR = Object.freeze([
  "SALIDA_INVALIDA", "LONGITUD", "CIFRA_SUELTA", "CIFRA_EN_PALABRAS", "HECHO_DESCONOCIDO", "HECHO_NO_CITADO",
  "ETIQUETA_NO_COINCIDE", "DIRECCION_CONTRADICE", "RECOMENDACION", "PREDICCION", "TRATO", "IDIOMA", "FORMATO", "RENDER_CIFRA",
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

export const CODIGOS_ERROR_VALIDADOR = Object.freeze(["PAQUETE_NO_CONSTRUIDO"] as const);
export type CodigoErrorValidador = (typeof CODIGOS_ERROR_VALIDADOR)[number];

/** Un defecto del código (no de la salida del modelo): lanza, sin repetir datos. */
export class ErrorValidador extends Error {
  override readonly name = "ErrorValidador";
  constructor(readonly codigo: CodigoErrorValidador) {
    super(`Validador de la salida: ${codigo}.`);
  }
}
