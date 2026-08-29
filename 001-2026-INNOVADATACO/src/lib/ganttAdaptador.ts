/**
 * Adaptador del Gantt: traduce el dominio (entregables, hitos) al contrato
 * genérico de `@/lib/gantt` (spec 015). La matemática no conoce el dominio;
 * este archivo sí. Puro y testeable.
 */
import type { ItemGantt } from "./gantt";

export interface EntregableGantt {
  id: string;
  nombre: string;
  avance: number;
  fechaInicio: string | null;
  fechaCompromiso: string | null;
  createdAt: string;
  dependeDe?: string | null;
}

export interface HitoGantt {
  id: string;
  nombre: string;
  fecha: string;
  fechaFin: string | null;
  dependeDe?: string | null;
}

/**
 * Barra por entregable: de su inicio a su fecha de compromiso (FR-001/FR-006).
 *
 * El inicio es `fechaInicio`; si el entregable es anterior a esta spec y no la
 * tiene, se usa su `createdAt` para no dejarlo fuera del Gantt. Un entregable
 * **sin fecha de compromiso** no se puede situar en el tiempo: se excluye (y
 * sigue en la lista del cronograma).
 */
export function entregablesAItems(entregables: EntregableGantt[]): ItemGantt[] {
  return entregables
    .filter((e) => e.fechaCompromiso)
    .map((e) => ({
      id: `entregable:${e.id}`,
      tipo: "barra" as const,
      inicio: new Date(e.fechaInicio ?? e.createdAt),
      fin: new Date(e.fechaCompromiso as string),
      avance: e.avance,
      label: e.nombre,
      dependeDe: e.dependeDe ?? null,
    }));
}

/**
 * Rombo por hito; rango si tiene `fechaFin` (FR-001).
 * Un hito siempre tiene `fecha`, así que ninguno se excluye.
 */
export function hitosAItems(hitos: HitoGantt[]): ItemGantt[] {
  return hitos.map((h) => ({
    id: `hito:${h.id}`,
    tipo: "hito" as const,
    inicio: new Date(h.fecha),
    fin: h.fechaFin ? new Date(h.fechaFin) : null,
    label: h.nombre,
    dependeDe: h.dependeDe ?? null,
  }));
}

/** Cuántos entregables quedaron fuera del Gantt por no tener fecha de compromiso. */
export function entregablesSinFecha(entregables: EntregableGantt[]): number {
  return entregables.filter((e) => !e.fechaCompromiso).length;
}
