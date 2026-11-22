/**
 * Qué valores del sistema se calcularon con un dato (frente fecha-hora-datos): las especies (control VALOR) y los
 * fondos (control FONDO) que tienen `esperado`. Sin precio o sin unidades no hay cifra del sistema, y entonces tampoco
 * procedencia que mostrar. Puro: lo usan el lector de las procedencias y el serializador.
 */
import type { ConciliacionLeida } from "@/conciliacion/leer";

export interface IdsCalculados {
  readonly especies: string[];
  readonly fondos: string[];
}

export function idsCalculados(c: Pick<ConciliacionLeida, "controles">): IdsCalculados {
  const de = (tipo: "VALOR" | "FONDO") =>
    [...new Set(c.controles.flatMap((k) => (k.tipo === tipo && k.instrumentoId !== null && k.esperado !== null ? [k.instrumentoId] : [])))];
  return { especies: de("VALOR"), fondos: de("FONDO") };
}
