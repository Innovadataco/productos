/** Hallazgos de una carga del registro del dueño (fase C: decretos, C4a). PENDIENTE (rojo de C4a). */
export interface Hallazgo {
  readonly linea: number;
  readonly columna: string | null;
  readonly codigo: string;
}

export const MAX_HALLAZGOS = 100;

export const enTodoElArchivo = (_codigo: string): Hallazgo => {
  throw new Error("PENDIENTE");
};

export function ordenar(_hallazgos: readonly Hallazgo[]): Hallazgo[] {
  throw new Error("PENDIENTE");
}

export function recortar(_hallazgos: readonly Hallazgo[]): { readonly total: number; readonly hallazgos: readonly Hallazgo[] } {
  throw new Error("PENDIENTE");
}
