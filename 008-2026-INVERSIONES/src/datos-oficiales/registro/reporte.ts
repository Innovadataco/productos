/** Salida de los CLI del registro del dueño (fase C: decretos, C4a). PENDIENTE (rojo de C4a). */
import type { Hallazgo } from "./hallazgos";

export interface OpcionesSalida {
  readonly produccion: boolean;
}

export type CodigoSalida = 0 | 1 | 2 | 3;

export interface SalidaCli {
  readonly codigoSalida: CodigoSalida;
  readonly lineas: readonly string[];
  readonly errores: readonly string[];
}

export interface Consola {
  readonly log: (linea: string) => void;
  readonly error: (linea: string) => void;
}

export const bien = (_lineas: readonly string[]): SalidaCli => {
  throw new Error("PENDIENTE");
};

export function fallo(_o: OpcionesSalida, _codigoSalida: Exclude<CodigoSalida, 0>, _textos: readonly string[], _lineas: readonly string[] = []): SalidaCli {
  throw new Error("PENDIENTE");
}

export function lineasHallazgos(_hallazgos: readonly Hallazgo[], _total: number): string[] {
  throw new Error("PENDIENTE");
}

export function salidaError(_e: unknown, _o: OpcionesSalida): SalidaCli {
  throw new Error("PENDIENTE");
}

export function emitir(_s: SalidaCli, _consola: Consola): number {
  throw new Error("PENDIENTE");
}
