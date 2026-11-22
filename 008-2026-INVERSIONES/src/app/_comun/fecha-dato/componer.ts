/**
 * Un valor que suma varios datos (frente fecha-hora-datos): se muestra por el dato MÁS VIEJO que lo compone, y se dice
 * si hay datos de fechas distintas. Puro: no toca la lista y el resultado no depende de su orden. Los días y las horas
 * van como «AAAA-MM-DD» y «AAAA-MM-DD HH:MM», así que se comparan como texto (sin Date).
 */
import type { Procedencia, ProcedenciaCompuesta } from "./tipos";

/** ¿`a` es más viejo que `b`? Primero el día; con el mismo día, el traído antes (sin hora cuenta como el más viejo). */
function masViejo(a: Procedencia, b: Procedencia): boolean {
  if (a.dia !== b.dia) return a.dia < b.dia;
  if (a.traidoEn === b.traidoEn) return (a.fuente ?? "") < (b.fuente ?? "");
  if (a.traidoEn === null) return true;
  return b.traidoEn !== null && a.traidoEn < b.traidoEn;
}

/** Por código (igual en servidor y navegador, sin depender del idioma); sin fuente, al final. */
export const porCodigo = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1);

export function componer(procedencias: readonly Procedencia[]): ProcedenciaCompuesta | null {
  const [primera, ...resto] = procedencias;
  if (primera === undefined) return null;
  const masVieja = resto.reduce((v, p) => (masViejo(p, v) ? p : v), primera);
  const masReciente = resto.reduce((d, p) => (p.dia > d ? p.dia : d), primera.dia);
  const fuentes = [...new Set(procedencias.map((p) => p.fuente))].sort(porCodigo);
  return { masVieja, masReciente, mezcladas: masVieja.dia !== masReciente, fuentes };
}
