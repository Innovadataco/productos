/**
 * Lógica genérica del tablero Kanban (spec 007, FR-001).
 *
 * Este archivo NO conoce el dominio: habla de columnas y tarjetas, nunca de
 * oportunidades, estados, proyectos ni fases. Es la mitad reutilizable que
 * SPEC-008 usa para las fases PM2 sin cambiar una línea (RZ-1).
 *
 * Lo que decide comportamiento vive aquí, en funciones puras, para que la suite
 * lo cubra en entorno `node` sin DOM. El componente `KanbanBoard` es presentación
 * sobre estas funciones.
 */

/** Unidad del tablero. En Oportunidades es un estado del catálogo; en Proyectos, una fase. */
export interface ColumnaKanban {
  id: string;
  titulo: string;
  /** Clases Tailwind de acento. Presentación pura: su ausencia no rompe nada. */
  acento?: string;
}

/** Unidad movible. En Oportunidades es una oportunidad; en Proyectos, un proyecto. */
export interface TarjetaKanban {
  id: string;
  /** Columna en la que está hoy. */
  columnaId: string;
  titulo: string;
  /** Línea secundaria para identificarla sin abrirla (número, código…). */
  referencia?: string;
  /** Etiqueta corta (tipo, cliente…). */
  etiqueta?: string;
}

export interface ColumnaConTarjetas {
  columna: ColumnaKanban;
  tarjetas: TarjetaKanban[];
}

/**
 * Agrupa las tarjetas por columna respetando el ORDEN de `columnas` (FR-003).
 *
 * Una columna sin tarjetas se devuelve vacía, no se omite (US1-3): el tablero
 * debe mostrar el catálogo completo, no solo lo que está poblado.
 */
export function agruparPorColumna(
  columnas: ColumnaKanban[],
  tarjetas: TarjetaKanban[],
): ColumnaConTarjetas[] {
  return columnas.map((columna) => ({
    columna,
    tarjetas: tarjetas.filter((t) => t.columnaId === columna.id),
  }));
}

/**
 * Tarjetas cuya columna no existe en el tablero (US1-2).
 *
 * Un dato inconsistente —una oportunidad apuntando a un estado borrado— no puede
 * romper el tablero ni desaparecer en silencio: queda fuera de las columnas y
 * quien use el componente decide cómo reportarlo.
 */
export function tarjetasHuerfanas(
  columnas: ColumnaKanban[],
  tarjetas: TarjetaKanban[],
): TarjetaKanban[] {
  const conocidas = new Set(columnas.map((c) => c.id));
  return tarjetas.filter((t) => !conocidas.has(t.columnaId));
}

/**
 * Reparto del ancho del tablero (spec 007, FR-012 — defecto I-014).
 *
 * El tablero nació con columnas de ancho fijo dentro de un contenedor acotado:
 * 5 columnas de 18rem más sus separaciones piden ~1504 px y el área real de
 * contenido son ~1184 px, así que la última quedaba fuera de la pantalla detrás
 * de una barra de desplazamiento. El CEO lo reportó como I-014.
 *
 * A partir de aquí las columnas **reparten** el ancho disponible en vez de
 * imponerlo. Pero repartir no puede ser incondicional: los estados son un
 * catálogo configurable (§0.7) y con doce columnas el reparto daría tarjetas
 * ilegibles. Por encima del umbral se vuelve al desplazamiento horizontal, que
 * ahí sí es la respuesta correcta.
 */
export const MAX_COLUMNAS_REPARTIDAS = 6;

/** ¿Caben todas las columnas repartiendo el ancho, o hay que desplazar? */
export function seRepartenLasColumnas(cantidad: number): boolean {
  return cantidad > 0 && cantidad <= MAX_COLUMNAS_REPARTIDAS;
}

/**
 * Plantilla de rejilla para repartir el ancho a partes iguales.
 *
 * `minmax(0, 1fr)` y no `1fr` a secas: sin el mínimo en 0, una tarjeta con una
 * palabra larga estira su columna y rompe el reparto.
 */
export function plantillaDeColumnas(cantidad: number): string {
  return `repeat(${cantidad}, minmax(0, 1fr))`;
}

/**
 * ¿Soltar esta tarjeta en esta columna es un cambio real? (FR-009)
 *
 * `false` si la tarjeta no existe o si ya está en la columna destino. El
 * componente consulta esto antes de emitir `onMover`, así que soltar una tarjeta
 * en su propia columna no dispara ni llamada ni auditoría sin depender de que
 * cada consumidor se acuerde de comprobarlo.
 */
export function esMovimientoReal(
  tarjetas: TarjetaKanban[],
  tarjetaId: string,
  columnaDestinoId: string,
): boolean {
  const tarjeta = tarjetas.find((t) => t.id === tarjetaId);
  if (!tarjeta) return false;
  return tarjeta.columnaId !== columnaDestinoId;
}
