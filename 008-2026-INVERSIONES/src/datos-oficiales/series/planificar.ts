/**
 * Qué hacer con las filas de una serie frente a sus vigentes en la base (fase C, C2a). Puro: lo usa el camino único
 * (guardar.ts) dentro de la transacción de cada lote, sobre lo que acaba de leer.
 * - Sin vigente que se solape: la fila entra NUEVA.
 * - Un solo vigente con el mismo desde, el mismo hasta y el mismo valor (como decimal: 9.53 = 9.53000000): SIN CAMBIOS.
 *   La fuente no entra en la comparación: si entrara, cada anexo mensual del DANE reescribiría toda la historia.
 * - Cualquier otra cosa: REVISIÓN. Se retiran TODOS los vigentes que se solapan con la fila (cada uno una sola vez,
 *   aunque toque varias filas) y la fila entra; los días de un retirado que ninguna fila nueva cubre se cuentan (la
 *   fuente acortó una vigencia: esos días quedan sin vigente).
 * Precondición (la garantiza el CSV, csv-series.ts): las filas van ordenadas por desde y no se solapan entre sí. Los
 * vigentes tampoco (la exclusión de la base); llegan en cualquier orden.
 */
import { canonizarValor, type ValorSerie } from "./csv-series";

const DIA_MS = 86_400_000;

/** Un vigente de la base: su id, su vigencia y su valor como texto decimal (Prisma.Decimal#toFixed()). */
export interface VigenteSerie {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: string;
}

export interface PlanSerie {
  readonly nuevas: readonly ValorSerie[];
  readonly revisadas: readonly ValorSerie[];
  readonly sinCambios: number;
  /** Los ids de los vigentes que se retiran, sin repetir, en orden de desde. */
  readonly aRetirar: readonly string[];
  readonly diasDescubiertos: number;
  /** El hasta más tardío de lo que se retira (para alargar el lote: finDeLote), o null si no se retira nada. */
  readonly extremoRetirado: Date | null;
}

type Tramo = { readonly desde: Date; readonly hasta: Date };
const seSolapan = (a: Tramo, b: Tramo): boolean => a.desde.getTime() <= b.hasta.getTime() && b.desde.getTime() <= a.hasta.getTime();
const dias = (desde: number, hasta: number): number => (hasta < desde ? 0 : (hasta - desde) / DIA_MS + 1);
const comun = (a: Tramo, b: Tramo): number => dias(Math.max(a.desde.getTime(), b.desde.getTime()), Math.min(a.hasta.getTime(), b.hasta.getTime()));

function mismaVigenciaYValor(fila: ValorSerie, v: VigenteSerie): boolean {
  const valor = canonizarValor(fila.valor);
  return fila.desde.getTime() === v.desde.getTime() && fila.hasta.getTime() === v.hasta.getTime() && valor !== null && valor === canonizarValor(v.valor);
}

/** Los vigentes (ordenados por desde, sin solapes entre sí) que se solapan con cada fila, en una sola pasada. */
function solapadosPorFila(filas: readonly ValorSerie[], vigentes: readonly VigenteSerie[]): VigenteSerie[][] {
  let primero = 0;
  return filas.map((fila) => {
    while (primero < vigentes.length && vigentes[primero]!.hasta.getTime() < fila.desde.getTime()) primero += 1;
    const tocados: VigenteSerie[] = [];
    for (let i = primero; i < vigentes.length && vigentes[i]!.desde.getTime() <= fila.hasta.getTime(); i += 1) tocados.push(vigentes[i]!);
    return tocados;
  });
}

/** Los días de los retirados que no cubre ninguna fila que entra (las filas no se solapan entre sí: la suma es exacta). */
function descubiertos(retirados: readonly VigenteSerie[], entran: readonly ValorSerie[]): number {
  return retirados.reduce((total, v) => total + dias(v.desde.getTime(), v.hasta.getTime()) - entran.filter((f) => seSolapan(f, v)).reduce((s, f) => s + comun(f, v), 0), 0);
}

export function planificar(filas: readonly ValorSerie[], vigentes: readonly VigenteSerie[]): PlanSerie {
  const ordenados = [...vigentes].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  const solapados = solapadosPorFila(filas, ordenados);
  const nuevas: ValorSerie[] = [];
  const revisadas: ValorSerie[] = [];
  const retirados = new Map<string, VigenteSerie>();
  let sinCambios = 0;
  filas.forEach((fila, i) => {
    const tocados = solapados[i]!;
    if (tocados.length === 0) nuevas.push(fila);
    else if (tocados.length === 1 && mismaVigenciaYValor(fila, tocados[0]!)) sinCambios += 1;
    else {
      revisadas.push(fila);
      for (const v of tocados) retirados.set(v.id, v);
    }
  });
  const lista = [...retirados.values()].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  const extremo = lista.reduce<number | null>((m, v) => (m === null || v.hasta.getTime() > m ? v.hasta.getTime() : m), null);
  return {
    nuevas, revisadas, sinCambios,
    aRetirar: lista.map((v) => v.id),
    diasDescubiertos: descubiertos(lista, [...nuevas, ...revisadas]),
    extremoRetirado: extremo === null ? null : new Date(extremo),
  };
}

/**
 * Hasta dónde va el lote que hoy termina en `fin` (exclusivo): si lo que se retira llega hasta `extremo`, el lote
 * incluye las filas siguientes que empiezan ese día o antes, para que el retiro y todo su reemplazo vayan en la misma
 * transacción. Devuelve `fin` si no hay que alargar.
 */
export function finDeLote(filas: readonly ValorSerie[], fin: number, extremo: Date | null): number {
  if (extremo === null) return fin;
  let nuevoFin = fin;
  while (nuevoFin < filas.length && filas[nuevoFin]!.desde.getTime() <= extremo.getTime()) nuevoFin += 1;
  return nuevoFin;
}
