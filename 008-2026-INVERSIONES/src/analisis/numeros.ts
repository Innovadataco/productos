/**
 * Números del motor de análisis. Puro.
 * - Las métricas estadísticas son `number` redondeadas a DECIMALES_METRICA decimales al final del cálculo (nunca en los
 *   pasos intermedios): `Number(x.toFixed(8))`, que toma el múltiplo de 10⁻⁸ más cercano al valor binario. El error de
 *   cada métrica es a lo sumo 0,5 × 10⁻⁸; −0 sale 0. Las observaciones comparan el valor ya redondeado: el que ve el dueño.
 * - Los textos se comparan por unidad de código (nunca con las reglas de un idioma, que dependen de la máquina).
 */
export const DECIMALES_METRICA = 8;

export function redondear(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError("Una métrica debe ser un número finito.");
  return Number(x.toFixed(DECIMALES_METRICA)) + 0;
}

export function compararTexto(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
