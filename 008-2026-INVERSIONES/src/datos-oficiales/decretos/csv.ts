/** El CSV de decretos que escribe el dueño (fase C, C4a). PENDIENTE (rojo de C4a). */
import type { Crudo } from "../../cifrado/campos";
import type { Hallazgo } from "../registro/hallazgos";
import { COLUMNAS, type DecretoLeido } from "./filas";

export const ENCABEZADO_DECRETOS: readonly string[] = COLUMNAS;
export const MAX_BYTES_DECRETOS = 1024 * 1024;
export const MAX_FILAS_DECRETOS = 2000;

export interface FilaDecreto {
  readonly decreto: DecretoLeido;
  readonly crudo: Crudo;
}

export type LecturaDecretos =
  | { readonly ok: true; readonly sha256: string; readonly filas: readonly FilaDecreto[] }
  | { readonly ok: false; readonly sha256: string; readonly hallazgos: readonly Hallazgo[] };

export const claveTexto = (_d: Pick<DecretoLeido, "especie" | "tipo" | "fechaAnuncio" | "cuota">): string => {
  throw new Error("PENDIENTE");
};

export function leerCsvDecretos(_bytes: Uint8Array, _hoy: Date): LecturaDecretos {
  throw new Error("PENDIENTE");
}
