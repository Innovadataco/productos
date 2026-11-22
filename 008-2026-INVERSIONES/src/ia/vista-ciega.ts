/** Esqueleto (rojo). */
import type { PaqueteCiego, PaqueteHechos, TipoResumen } from "./contrato";
export const CODIGOS_FUGA_VISTA = Object.freeze([
  "FORMA_INVALIDA", "CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE", "PRESENTACION_DEL_PAQUETE",
  "NOMBRE_DE_ESPECIE", "CLAVE_PROHIBIDA", "NO_CORRESPONDE", "HASH_NO_COINCIDE",
] as const);
export type CodigoFugaVista = (typeof CODIGOS_FUGA_VISTA)[number];

export class ErrorVistaCiega extends Error {
  override readonly name = "ErrorVistaCiega";
  constructor(readonly codigos: readonly CodigoFugaVista[]) {
    super(`Vista ciega rechazada: ${codigos.join(", ")}.`);
  }
}

export function fugasDeVistaCiega(_vista: unknown, _paquete: PaqueteHechos): readonly CodigoFugaVista[] { throw new Error("SIN_IMPLEMENTAR"); }
export function asegurarVistaCiega(_vista: unknown, _paquete: PaqueteHechos): asserts _vista is PaqueteCiego { throw new Error("SIN_IMPLEMENTAR"); }
export function vistaCiega<T extends TipoResumen>(_paquete: PaqueteHechos<T>): PaqueteCiego<T> { throw new Error("SIN_IMPLEMENTAR"); }
