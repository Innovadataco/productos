/**
 * Errores de los armadores de hechos (E1b). Cierran en fallo con un código cerrado; el mensaje lleva solo el código,
 * nunca un valor, un nombre ni una fecha recibidos. Lo que el armador no rechaza lo rechaza después `construirPaquete`
 * con su `ErrorPaquete`.
 */
import type { ClaveHecho } from "../catalogo";

export const CODIGOS_ERROR_ARMADO = Object.freeze([
  "HOY_INVALIDO", "FECHA_INVALIDA", "FECHA_FUTURA", "DECIMAL_INVALIDO", "NUMERO_INVALIDO", "SERIE_DESCONOCIDA", "SERIE_REPETIDA",
  "VERSION_NO_VIGENTE", "HOY_DISTINTO", "HORIZONTES_INVALIDOS", "REFERENCIA_INVALIDA", "CLAVE_FUERA_DE_CATALOGO", "VALOR_INVALIDO",
  "FUENTE_DESCONOCIDA", "FRESCURA_INCOHERENTE",
] as const);
export type CodigoErrorArmado = (typeof CODIGOS_ERROR_ARMADO)[number];

/**
 * Se distingue de `ErrorPaquete` por `instanceof` o por `name` (algunos códigos se llaman igual en los dos). `clave` es
 * la del catálogo del hecho que falló, cuando se sabe: una constante del código, no un dato recibido; no va en el mensaje.
 */
export class ErrorArmado extends Error {
  override readonly name = "ErrorArmado";
  constructor(
    readonly codigo: CodigoErrorArmado,
    readonly clave: ClaveHecho | null = null,
  ) {
    super(`Armado de hechos rechazado: ${codigo}.`);
  }
}
