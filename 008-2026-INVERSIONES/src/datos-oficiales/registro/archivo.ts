/** Lectura del CSV que escribe el dueño para el registro (fase C: decretos, C4a). PENDIENTE (rojo de C4a). */
import type { Hallazgo } from "./hallazgos";

export interface ReglasArchivo {
  readonly encabezado: readonly string[];
  readonly maxBytes: number;
  readonly maxFilas: number;
}

export interface FilaArchivo {
  readonly numero: number;
  readonly celdas: readonly string[];
  readonly crudo: Readonly<Record<string, string>>;
}

export type LecturaArchivo =
  | { readonly ok: true; readonly sha256: string; readonly filas: readonly FilaArchivo[] }
  | { readonly ok: false; readonly sha256: string; readonly hallazgos: readonly Hallazgo[] };

export function leerArchivoRegistro(_bytes: Uint8Array, _reglas: ReglasArchivo): LecturaArchivo {
  throw new Error("PENDIENTE");
}
