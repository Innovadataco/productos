/**
 * Un cierre por especie y día (frente graficas-tablero). La base deja un cierre vigente por fuente y día; si hay dos
 * fuentes el mismo día, gana el traído más recientemente y, con el mismo `traidoEn`, el id mayor: la regla de
 * `ultimosCierres` (src/plan/lectura.ts). Así el tablero, su serie de 60 y la evolución nunca eligen al azar.
 * Puro: no toca la entrada.
 */
export interface CierreConOrigen {
  readonly id: string;
  readonly instrumentoId: string;
  readonly fecha: Date;
  readonly traidoEn: Date;
}

/** ¿`a` gana sobre `b` (mismo día)? */
const gana = (a: CierreConOrigen, b: CierreConOrigen): boolean =>
  a.traidoEn.getTime() !== b.traidoEn.getTime() ? a.traidoEn.getTime() > b.traidoEn.getTime() : a.id > b.id;

/** Uno por (especie, día), ordenados por especie y fecha ascendente. */
export function unCierrePorDia<T extends CierreConOrigen>(filas: readonly T[]): T[] {
  const elegidos = new Map<string, T>();
  for (const f of filas) {
    const clave = `${f.instrumentoId}|${f.fecha.getTime()}`;
    const actual = elegidos.get(clave);
    if (!actual || gana(f, actual)) elegidos.set(clave, f);
  }
  return [...elegidos.values()].sort((a, b) =>
    a.instrumentoId < b.instrumentoId ? -1 : a.instrumentoId > b.instrumentoId ? 1 : a.fecha.getTime() - b.fecha.getTime());
}
