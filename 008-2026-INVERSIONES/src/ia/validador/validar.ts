/** Esqueleto (rojo): el validador. */
import type { PaqueteHechos, TipoResumen } from "../contrato";
import type { ResultadoValidacion } from "./tipos";

export function validarSalida<T extends TipoResumen>(_salidaCruda: unknown, _paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  throw new Error("SIN_IMPLEMENTAR");
}
