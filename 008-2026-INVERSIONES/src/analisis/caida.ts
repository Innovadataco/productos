/**
 * Caída máxima de un índice de precio: la mayor caída desde un máximo previo. Puro.
 * El pico se mueve solo con un máximo estrictamente mayor y el valle solo con una caída estrictamente mayor: en un
 * empate gana la primera. Se redondea a DECIMALES_METRICA; una caída que redondea a 0 es SIN_CAIDA.
 */
import type { Dia } from "../proyecciones/tipos";
import { redondear } from "./numeros";
import type { CaidaMaxima } from "./tipos";

/** `indice`: positivo, uno por día. */
export function caidaMaxima(dias: readonly Dia[], indice: readonly number[]): CaidaMaxima {
  if (dias.length !== indice.length) throw new RangeError("Debe haber un valor del índice por día.");
  if (indice.some((x) => !Number.isFinite(x) || x <= 0)) throw new RangeError("El índice debe ser positivo y finito.");
  let pico = 0;
  let mayor = { fraccion: 0, pico: 0, valle: 0 };
  indice.forEach((x, j) => {
    if (x > indice[pico]!) pico = j;
    const fraccion = 1 - x / indice[pico]!;
    if (fraccion > mayor.fraccion) mayor = { fraccion, pico, valle: j };
  });
  const fraccion = redondear(mayor.fraccion);
  return fraccion === 0 ? { estado: "SIN_CAIDA" } : { estado: "CAIDA", fraccion, pico: dias[mayor.pico]!, valle: dias[mayor.valle]! };
}
