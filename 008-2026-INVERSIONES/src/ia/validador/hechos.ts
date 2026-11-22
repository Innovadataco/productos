/**
 * Los hechos del paquete por id y la cadena de sujetos de un hecho: del hecho a su sujeto y así, hasta el nombre de la
 * especie (unidad NOMBRE). Hoy la cadena tiene un solo eslabón (el sujeto es el nombre); con las anclas por regla de
 * E1b tendrá dos. El recorrido está acotado por el número de hechos (un ciclo no lo cuelga) y, si no termina en un
 * nombre, la cadena no tiene raíz.
 */
import type { Hecho, IdHecho, PaqueteHechos } from "../contrato";

export type HechosPorId = ReadonlyMap<string, Hecho>;

export const hechosPorId = (paquete: PaqueteHechos): HechosPorId => new Map(paquete.hechos.map((h) => [h.id, h]));

export const esNombre = (hecho: Hecho | undefined): boolean => hecho?.unidad === "NOMBRE";

export interface CadenaDeSujetos {
  /** Los ids de la cadena, sin el hecho mismo (el sujeto, el sujeto del sujeto…). */
  readonly ids: readonly IdHecho[];
  /** El nombre de la especie en que termina, o undefined si el hecho no tiene sujeto o la cadena no llega a un nombre. */
  readonly raiz: IdHecho | undefined;
}

export function cadenaDeSujetos(hecho: Hecho, porId: HechosPorId): CadenaDeSujetos {
  const ids: IdHecho[] = [];
  let actual: Hecho | undefined = hecho;
  for (let pasos = 0; actual?.sujeto !== undefined && pasos < porId.size; pasos += 1) {
    const sujeto: IdHecho = actual.sujeto;
    ids.push(sujeto);
    actual = porId.get(sujeto);
    if (esNombre(actual)) return Object.freeze({ ids: Object.freeze(ids), raiz: sujeto });
  }
  return Object.freeze({ ids: Object.freeze(ids), raiz: undefined });
}
