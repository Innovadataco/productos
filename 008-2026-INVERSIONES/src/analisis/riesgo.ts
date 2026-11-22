/**
 * Riesgo de un portafolio desde retornos diarios. Puro y sin redondeo (lo redondea quien arma el resultado).
 * - Covarianza muestral (n − 1, la de `desviacion` de src/proyecciones/estadistica.ts), en dos pasadas.
 * - Una columna «no varía» si su desviación diaria es menor que DESVIACION_DIARIA_MINIMA: su covarianza cuenta como 0,
 *   su volatilidad es 0 y su correlación con cualquiera, también con ella misma, es null (no se inventa).
 * - Correlación recortada a [−1, 1], calculada una vez por par y espejada (la matriz sale simétrica exacta).
 * - Euler sobre la covarianza ANUAL (Σa = A × Σ): σp = √max(0, w'Σa w); marginal = (Σa w)ₖ / σp; contribución =
 *   wₖ × marginal; porcentual = contribución / σp. Las contribuciones suman σp (identidad de Euler). Con σp menor que
 *   VOLATILIDAD_MINIMA no hay riesgo que repartir: las contribuciones son null.
 */
import { media } from "../proyecciones/estadistica";

/** Por debajo, la columna no varía (una acción real se mueve del orden de 10⁻² al día). */
export const DESVIACION_DIARIA_MINIMA = 1e-10;
/** Por debajo, la volatilidad anual del portafolio cuenta como 0 (los ruidos de coma flotante son del orden de 10⁻¹⁶). */
export const VOLATILIDAD_MINIMA = 1e-12;
/** Tolerancia de los pesos: deben sumar 1. */
const TOLERANCIA_PESOS = 1e-9;
/** Error de cada cifra redondeada a 8 decimales (0,5 × 10⁻⁸), con el doble de margen. */
const ERROR_POR_CIFRA = 1e-8;

export interface RiesgoColumna {
  readonly volatilidad: number;
  readonly marginal: number | null;
  readonly contribucion: number | null;
  readonly contribucionPct: number | null;
}

export interface Descomposicion {
  readonly volatilidad: number;
  readonly columnas: readonly RiesgoColumna[];
}

/**
 * Cuánto pueden diferir la suma de K contribuciones redondeadas y la volatilidad redondeada: cada una de las K + 1 cifras
 * redondeadas a 8 decimales lleva a lo sumo 0,5 × 10⁻⁸ de error; se da el doble de margen.
 */
export function toleranciaSuma(K: number): number {
  return (K + 1) * ERROR_POR_CIFRA;
}

/** K × K desde K columnas de T retornos cada una (T ≥ 2). */
export function covarianzaMuestral(columnas: readonly (readonly number[])[]): number[][] {
  if (columnas.length === 0) return [];
  const T = columnas[0]!.length;
  if (T < 2) throw new RangeError("La covarianza necesita al menos dos retornos.");
  if (columnas.some((c) => c.length !== T)) throw new RangeError("Las columnas deben tener el mismo largo.");
  const centradas = columnas.map((c) => {
    const m = media(c);
    return c.map((x) => x - m);
  });
  const cov = (i: number, j: number) => centradas[i]!.reduce((s, x, t) => s + x * centradas[j]![t]!, 0) / (T - 1);
  const K = columnas.length;
  const matriz = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  for (let i = 0; i < K; i += 1) {
    for (let j = i; j < K; j += 1) {
      const c = cov(i, j);
      matriz[i]![j] = c;
      matriz[j]![i] = c;
    }
  }
  return matriz;
}

const varia = (cov: readonly (readonly number[])[], k: number): boolean => Math.sqrt(Math.max(0, cov[k]![k]!)) >= DESVIACION_DIARIA_MINIMA;
const recortar = (x: number): number => Math.min(1, Math.max(-1, x));

export function correlacionDe(cov: readonly (readonly number[])[]): (number | null)[][] {
  const K = cov.length;
  const rho = Array.from({ length: K }, () => new Array<number | null>(K).fill(null));
  for (let i = 0; i < K; i += 1) {
    if (!varia(cov, i)) continue;
    rho[i]![i] = 1;
    for (let j = i + 1; j < K; j += 1) {
      if (!varia(cov, j)) continue;
      const r = recortar(cov[i]![j]! / Math.sqrt(cov[i]![i]! * cov[j]![j]!));
      rho[i]![j] = r;
      rho[j]![i] = r;
    }
  }
  return rho;
}

function validarPesos(pesos: readonly number[], K: number, factor: number): void {
  if (pesos.length !== K) throw new RangeError("Debe haber un peso por columna.");
  if (pesos.some((w) => !Number.isFinite(w) || w < 0)) throw new RangeError("Los pesos deben ser números no negativos.");
  if (Math.abs(pesos.reduce((s, w) => s + w, 0) - 1) > TOLERANCIA_PESOS) throw new RangeError("Los pesos deben sumar 1.");
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError("El factor de anualización debe ser positivo.");
}

/** Σa = A × Σ, con 0 en las filas y columnas de las que no varían. */
function anual(cov: readonly (readonly number[])[], factor: number): number[][] {
  const vivas = cov.map((_, k) => varia(cov, k));
  return cov.map((fila, i) => fila.map((c, j) => (vivas[i] && vivas[j] ? c * factor : 0)));
}

/** `pesos`: no negativos y que suman 1. `factor`: A en √A (ruedas por año). */
export function descomponerRiesgo(cov: readonly (readonly number[])[], pesos: readonly number[], factor: number): Descomposicion {
  validarPesos(pesos, cov.length, factor);
  const sa = anual(cov, factor);
  const sw = sa.map((fila) => fila.reduce((s, c, j) => s + c * pesos[j]!, 0));
  const varianza = pesos.reduce((s, w, i) => s + w * sw[i]!, 0);
  const sigma = Math.sqrt(Math.max(0, varianza));
  const hay = sigma >= VOLATILIDAD_MINIMA;
  const columnas = sa.map((fila, k): RiesgoColumna => {
    const volatilidad = Math.sqrt(fila[k]!);
    if (!hay) return { volatilidad, marginal: null, contribucion: null, contribucionPct: null };
    const marginal = sw[k]! / sigma;
    const contribucion = pesos[k]! * marginal;
    return { volatilidad, marginal, contribucion, contribucionPct: contribucion / sigma };
  });
  return { volatilidad: hay ? sigma : 0, columnas };
}
