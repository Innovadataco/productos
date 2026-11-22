/** Días `AAAA-MM-DD` del motor de análisis (medianoche UTC, como las columnas DATE). Puro. */
import type { Dia } from "../proyecciones/tipos";

/** El mismo día `meses` meses antes; si ese mes es más corto, su último día (31 de marzo − 1 mes = 28 o 29 de febrero). */
export function restarMeses(dia: Dia, meses: number): Dia {
  throw new Error("sin implementar");
}

/** Días calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: Dia, hasta: Dia): number {
  throw new Error("sin implementar");
}
