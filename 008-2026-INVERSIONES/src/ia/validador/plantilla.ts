/** Esqueleto (rojo): la plantilla sin IA (nivel 0). */
import type { PaqueteHechos, TipoResumen } from "../contrato";
import type { ResultadoValidacion } from "./tipos";

export function salidaDePlantilla(_paquete: PaqueteHechos): string {
  throw new Error("SIN_IMPLEMENTAR");
}
export function resumenSinIa<T extends TipoResumen>(_paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  throw new Error("SIN_IMPLEMENTAR");
}
