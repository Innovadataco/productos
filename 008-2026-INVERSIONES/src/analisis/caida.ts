/**
 * Caída máxima de un índice de precio: la mayor caída desde un máximo previo. Puro.
 * El pico se mueve solo con un máximo estrictamente mayor y el valle solo con una caída estrictamente mayor: en un
 * empate gana la primera. Se redondea a DECIMALES_METRICA; una caída que redondea a 0 es SIN_CAIDA.
 */
import type { Dia } from "../proyecciones/tipos";
import type { CaidaMaxima } from "./tipos";

/** `indice`: positivo, uno por día. */
export function caidaMaxima(dias: readonly Dia[], indice: readonly number[]): CaidaMaxima {
  throw new Error("sin implementar");
}
