/**
 * Qué valores del sistema se calcularon con un dato (frente fecha-hora-datos): las especies (control VALOR) y los
 * fondos (control FONDO) que tienen `esperado`. Sin precio o sin unidades no hay cifra del sistema, y entonces tampoco
 * procedencia que mostrar. Puro (sin server-only): lo usan el lector de las procedencias y el serializador, y aquí
 * viven también la forma de lo que lee ese lector y su valor vacío.
 */
import type { ConciliacionLeida } from "@/conciliacion/leer";

export interface IdsCalculados {
  readonly especies: readonly string[];
  readonly fondos: readonly string[];
}

/** Cuándo trajo 008 un dato y de qué fuente. */
export interface Origen {
  readonly fuente: string;
  readonly traidoEn: Date;
}

export interface LecturaProcedencias {
  /** Por especie (instrumentoId): el cierre del corte con que se calculó su valor. */
  readonly cierres: ReadonlyMap<string, Origen>;
  /** Por fondo (instrumentoId): el valor de unidad del corte con que se calculó. */
  readonly fondos: ReadonlyMap<string, Origen>;
}

export const SIN_PROCEDENCIAS: LecturaProcedencias = Object.freeze({ cierres: new Map(), fondos: new Map() });

export function idsCalculados(c: Pick<ConciliacionLeida, "controles">): IdsCalculados {
  const de = (tipo: "VALOR" | "FONDO") =>
    [...new Set(c.controles.flatMap((k) => (k.tipo === tipo && k.instrumentoId !== null && k.esperado !== null ? [k.instrumentoId] : [])))];
  return { especies: de("VALOR"), fondos: de("FONDO") };
}
