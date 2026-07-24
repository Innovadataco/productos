/**
 * Adaptador de Proyectos para el tablero Kanban (spec 008, FR-008).
 *
 * Mismo patrón que `tableroOportunidades.ts` y misma frontera: aquí se conoce el
 * tablero, el tablero no conoce esto. La diferencia con SPEC-007 es de dónde
 * salen las columnas — allí de un catálogo en BD, aquí de las fases fijas de la
 * metodología (`FASES_PM2`).
 *
 * Que este archivo exista y `KanbanBoard.tsx` no haya cambiado ni una línea es
 * lo que acredita RZ-2 / SC-005.
 */
import type { ColumnaKanban, TarjetaKanban } from "./kanban";
import { FASES_PM2 } from "./fasesPm2";

/** Proyecto tal como lo necesita el tablero (subconjunto de `Proyecto`). */
export interface ProyectoTablero {
  id: string;
  codigo: string;
  nombre: string;
  cliente: string;
  currentPhase: string;
}

/** Acento por fase. Presentación pura: las fases son fijas, así que están todas. */
const ACENTO_POR_FASE: Record<string, string> = {
  initiation: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  planning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  execution: "bg-green-500/20 text-green-400 border-green-500/30",
  closing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

/** Una columna por fase PM2, en orden de metodología (FR-005). */
export function columnasDeFases(): ColumnaKanban[] {
  return FASES_PM2.map((fase) => ({
    id: fase.key,
    titulo: fase.nombre,
    acento: ACENTO_POR_FASE[fase.key],
  }));
}

/** Una tarjeta por proyecto, en la columna de su fase actual. */
export function tarjetasDeProyectos(proyectos: ProyectoTablero[]): TarjetaKanban[] {
  return proyectos.map((proyecto) => ({
    id: proyecto.id,
    columnaId: proyecto.currentPhase,
    titulo: proyecto.nombre,
    referencia: proyecto.codigo,
    etiqueta: proyecto.cliente || undefined,
  }));
}
