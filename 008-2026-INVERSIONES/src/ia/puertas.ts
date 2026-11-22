/** Esqueleto (rojo). */
import type { PaqueteHechos } from "./contrato";
import type { ExitoGeneracion, FalloGeneracion, Generador, PedidoGeneracion, Puerta } from "./generador";

export const MODOS_PUERTAS = Object.freeze(["apagado", "local", "nube", "local-luego-nube"] as const);
export type ModoPuertas = (typeof MODOS_PUERTAS)[number];

export const CODIGOS_ERROR_PUERTAS = Object.freeze(["MODO_PUERTAS_INVALIDO", "PUERTA_INVALIDA", "GENERADOR_DUPLICADO"] as const);
export type CodigoErrorPuertas = (typeof CODIGOS_ERROR_PUERTAS)[number];

/** Configuración o registro inválidos: lanza, sin repetir el valor recibido. */
export class ErrorPuertas extends Error {
  override readonly name = "ErrorPuertas";
  constructor(readonly codigo: CodigoErrorPuertas) {
    super(`Puertas de IA: ${codigo}.`);
  }
}

export type ResultadoPuertas =
  | { readonly ok: true; readonly exito: ExitoGeneracion; readonly fallosPrevios: readonly FalloGeneracion[] }
  /** Invariante: un fallo por cada puerta del orden (vacío con el modo apagado). */
  | { readonly ok: false; readonly fallos: readonly FalloGeneracion[] };

export function leerModoPuertas(_valor: string | undefined): ModoPuertas { throw new Error("SIN_IMPLEMENTAR"); }
export function ordenDePuertas(_modo: ModoPuertas): readonly Puerta[] { throw new Error("SIN_IMPLEMENTAR"); }
export async function generarConPuertas(_generadores: readonly Generador[], _modo: ModoPuertas, _pedido: PedidoGeneracion, _paquete: PaqueteHechos): Promise<ResultadoPuertas> { throw new Error("SIN_IMPLEMENTAR"); }
