/**
 * Los errores de la configuración de la IA (E8): un código cerrado, sin repetir lo recibido. Los de cada campo del
 * formulario van como `{ campo, codigo }` (nunca el valor: el destino es de la red privada del dueño).
 */
export const CODIGOS_ERROR_CONFIG = Object.freeze(["CONFIG_CAMBIO", "AUTOR_INEXISTENTE", "GASTO_NO_VERIFICABLE"] as const);
export type CodigoErrorConfig = (typeof CODIGOS_ERROR_CONFIG)[number];

export class ErrorConfigIa extends Error {
  override readonly name = "ErrorConfigIa";
  constructor(readonly codigo: CodigoErrorConfig) {
    super(`Configuración de la IA: ${codigo}.`);
  }
}

/** Un error de un campo del formulario (solo el campo y el código). */
export interface ErrorCampoConfig {
  readonly campo: string;
  readonly codigo: string;
}
