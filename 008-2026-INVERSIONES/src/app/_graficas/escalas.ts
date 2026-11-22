/** Escalas y marcas «bonitas» (pasos de 1, 2 o 5 por potencia de 10). Puro. */

export interface Escala {
  /** Del dato a la pantalla. */
  readonly a: (v: number) => number;
  /** De la pantalla al dato. */
  readonly de: (p: number) => number;
}

export function escalaLineal(dominio: readonly [number, number], rango: readonly [number, number]): Escala {
  const [d0, d1] = dominio;
  const [r0, r1] = rango;
  if (d1 === d0) return { a: () => (r0 + r1) / 2, de: () => d0 };
  const k = (r1 - r0) / (d1 - d0);
  return { a: (v) => r0 + (v - d0) * k, de: (p) => d0 + (p - r0) / k };
}

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);
const sinMenosCero = (v: number) => (v === 0 ? 0 : v);

/** Paso entre marcas; negativo = el inverso de un paso menor que 1 (así 3/5 da 0,6 exacto). */
function incremento(inicio: number, fin: number, cuantos: number): number {
  const paso = (fin - inicio) / Math.max(1, cuantos);
  const potencia = Math.floor(Math.log10(paso));
  const error = paso / 10 ** potencia;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  return potencia >= 0 ? factor * 10 ** potencia : -(10 ** -potencia) / factor;
}

export function ticksBonitos(min: number, max: number, cuantos: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  if (min === max) return [min];
  const inc = incremento(min, max, cuantos);
  const [i0, i1] = inc > 0 ? [Math.ceil(min / inc), Math.floor(max / inc)] : [Math.ceil(min * -inc), Math.floor(max * -inc)];
  return Array.from({ length: Math.max(0, i1 - i0 + 1) }, (_, k) => sinMenosCero(inc > 0 ? (i0 + k) * inc : (i0 + k) / -inc));
}

const MAX_VUELTAS = 10;

/** Dominio que contiene los valores (sin null), extendido a pasos bonitos; con `incluirCero`, el cero adentro. */
export function dominioY(valores: readonly (number | null)[], o: { readonly cuantos: number; readonly incluirCero?: boolean }): [number, number] {
  const nums = valores.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return [0, 1];
  let lo = Math.min(...nums, ...(o.incluirCero ? [0] : []));
  let hi = Math.max(...nums, ...(o.incluirCero ? [0] : []));
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  let previo = Number.NaN;
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta += 1) {
    const inc = incremento(lo, hi, o.cuantos);
    if (inc === previo) break;
    [lo, hi] = inc > 0 ? [Math.floor(lo / inc) * inc, Math.ceil(hi / inc) * inc] : [Math.ceil(lo * inc) / inc, Math.floor(hi * inc) / inc];
    previo = inc;
  }
  return [sinMenosCero(lo), sinMenosCero(hi)];
}

const dos = (v: number) => sinMenosCero(Math.round(v * 100) / 100);

/** Barras que crecen desde el cero: posición del cero y de cada barra en % del ancho (2 decimales). */
export function barrasDivergentes(valores: readonly number[]): { readonly cero: number; readonly barras: readonly { readonly izquierda: number; readonly ancho: number }[] } {
  const min = Math.min(0, ...valores);
  const max = Math.max(0, ...valores);
  const span = max - min;
  if (span === 0) return { cero: 0, barras: valores.map(() => ({ izquierda: 0, ancho: 0 })) };
  const cero = (-min / span) * 100;
  return {
    cero: dos(cero),
    barras: valores.map((v) => {
      const ancho = (Math.abs(v) / span) * 100;
      return { izquierda: dos(v >= 0 ? cero : cero - ancho), ancho: dos(ancho) };
    }),
  };
}
