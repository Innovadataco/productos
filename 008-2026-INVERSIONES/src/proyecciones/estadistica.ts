/** Estadística mínima del motor. Puro. */

/** Percentil de tipo 7 (interpolación lineal; el de NumPy y R por defecto) sobre datos YA ordenados. */
export function percentil(ordenados: ArrayLike<number>, q: number): number {
  const n = ordenados.length;
  if (n === 0) throw new RangeError("Sin datos para el percentil.");
  if (!(q >= 0 && q <= 1)) throw new RangeError("q debe estar en [0, 1].");
  const h = (n - 1) * q;
  const abajo = Math.floor(h);
  const arriba = Math.min(abajo + 1, n - 1);
  const a = ordenados[abajo]!;
  return a + (h - abajo) * (ordenados[arriba]! - a);
}

export function media(xs: readonly number[]): number {
  return xs.length === 0 ? Number.NaN : xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Desviación estándar muestral (n − 1); NaN con menos de dos datos. */
export function desviacion(xs: readonly number[]): number {
  if (xs.length < 2) return Number.NaN;
  const m = media(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
