/**
 * Hallazgos de una carga del registro del dueño (fase C: decretos, C4a): dónde (el número del registro en el archivo,
 * con el encabezado como 1; 0 = todo el archivo), en qué columna y qué código. Nunca el valor de la celda: el registro
 * es del dueño y sus especies revelan el portafolio. Puro.
 */
export interface Hallazgo {
  /** Número del registro en el archivo (el encabezado es el 1); 0 si es de todo el archivo. */
  readonly linea: number;
  /** Nombre de la columna del encabezado, o null si es de toda la fila o del archivo. */
  readonly columna: string | null;
  readonly codigo: string;
}

/** Cuántos se informan como máximo (el total se dice aparte). */
export const MAX_HALLAZGOS = 100;

export const enTodoElArchivo = (codigo: string): Hallazgo => ({ linea: 0, columna: null, codigo });

/** Por línea; dentro de una línea, en el orden en que llegaron (el orden de las columnas). */
export function ordenar(hallazgos: readonly Hallazgo[]): Hallazgo[] {
  return [...hallazgos].sort((a, b) => a.linea - b.linea);
}

/** Los primeros MAX_HALLAZGOS, ordenados, y cuántos hubo en total. */
export function recortar(hallazgos: readonly Hallazgo[]): { readonly total: number; readonly hallazgos: readonly Hallazgo[] } {
  return { total: hallazgos.length, hallazgos: ordenar(hallazgos).slice(0, MAX_HALLAZGOS) };
}
