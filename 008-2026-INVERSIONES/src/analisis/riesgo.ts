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

/** Por debajo, la columna no varía (una acción real se mueve del orden de 10⁻² al día). */
export const DESVIACION_DIARIA_MINIMA = 1e-10;
/** Por debajo, la volatilidad anual del portafolio cuenta como 0 (los ruidos de coma flotante son del orden de 10⁻¹⁶). */
export const VOLATILIDAD_MINIMA = 1e-12;
/** Tolerancia de los pesos: deben sumar 1. */
const TOLERANCIA_PESOS = 1e-9;

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
  throw new Error("sin implementar");
}

/** K × K desde K columnas de T retornos cada una (T ≥ 2). */
export function covarianzaMuestral(columnas: readonly (readonly number[])[]): number[][] {
  throw new Error("sin implementar");
}

export function correlacionDe(cov: readonly (readonly number[])[]): (number | null)[][] {
  throw new Error("sin implementar");
}

/** `pesos`: no negativos y que suman 1. `factor`: A en √A (ruedas por año). */
export function descomponerRiesgo(cov: readonly (readonly number[])[], pesos: readonly number[], factor: number): Descomposicion {
  throw new Error("sin implementar");
}
