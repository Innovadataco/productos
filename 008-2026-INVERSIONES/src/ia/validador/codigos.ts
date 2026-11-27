/**
 * Códigos, límites y versión del validador de la salida de un modelo (fase E). El validador cierra en fallo y devuelve
 * TODOS los códigos que encuentra, en este orden; el registro (`resumen_ia.motivos`) guarda esta misma lista cerrada.
 * v2: lee la salida `salida-v2` (segmentos; los hechos citados son las refs) y ya no revisa la lista `hechos`.
 * v3: en el DIARIO el código escribe los obligatorios que el modelo no cita (`obligatorias.ts`); el modelo trae al menos una frase.
 * v3, CAUSA: el texto no atribuye causas (`patrones-causa.ts`; el vocabulario pierde ante, segun, tras, frente, como, desde, con
 * y por, que solo valen si salen de las etiquetas). EXCEPCIÓN ESCRITA: no hay versión nueva, porque v3 (y la pila que la
 * extiende) no salió a producción; «una versión se congela al salir» no se rompe. Las filas y mediciones v3 anteriores
 * a este arreglo se validaron sin CAUSA. Condición: ningún despliegue con v3 y sin CAUSA. La misma excepción cubre la
 * ampliación de CAUSA (CAUSA.SIN, «es que», «a falta de(l)», «falta de(l)», CAUSA.TRANSITIVO, «vigente desde» solo con cita, y el vocabulario sin «cuando», los verbos de
 * atribución y las preposiciones sin uso medido): tampoco salió a producción. Y el cierre del causativo: CAUSA.TRANSITIVO cubre
 * todos los verbos de marca del vocabulario (menos «superó» y «rebasó»), con adverbio y determinantes de la base, solo ante
 * una palabra («subió un {H}» no cuenta). «bajó» y «bajo» van en CAUSA.TRANSITIVO_BAJO, sobre minúsculas: con tilde es el verbo
 * siempre y sin tilde se exime solo tras «escenario(s)» («escenario bajo el valor»); cada vocal del verbo, del adverbio y del determinante acepta una tilde de más
 * («bájo la», «bajó ésta», «bajó él»), como la iguala el vocabulario, que compara plegado; «bájo a {H}» sin determinante queda abierto (BAJO); ningún otro verbo pegado a «escenario» se exime
 * («del escenario subió el escenario alto» rechaza en ESCENARIOS). Abiertos documentados: `patrones-causa.ts`.
 * Cambiar un control, una lista de patrones o un límite es otra versión del validador (`VERSION_VALIDADOR`).
 */
export const VERSION_VALIDADOR = "validador-v3";
export type VersionValidador = typeof VERSION_VALIDADOR;

export const CODIGOS_VALIDADOR = Object.freeze([
  "SALIDA_INVALIDA", "LONGITUD", "CIFRA_SUELTA", "CIFRA_EN_PALABRAS", "HECHO_DESCONOCIDO", "HECHO_NO_CITADO",
  "ETIQUETA_NO_COINCIDE", "DIRECCION_CONTRADICE", "RECOMENDACION", "PREDICCION", "TRATO", "IDIOMA", "FORMATO", "RENDER_CIFRA",
  "CAUSA",
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
