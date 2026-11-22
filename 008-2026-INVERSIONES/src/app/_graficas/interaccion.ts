/** La mira de las gráficas de tiempo: el punto más cercano al puntero y el recorrido con el teclado. Puro. */
import type { Ventana } from "./tipos";

/** Índice del valor de `xs` (ordenado) más cercano a `x`, dentro de la ventana. */
export function indiceCercano(xs: readonly number[], x: number, v: Ventana): number {
  let lo = v.desde;
  let hi = v.hasta;
  while (hi - lo > 1) {
    const medio = (lo + hi) >> 1;
    if (xs[medio]! <= x) lo = medio;
    else hi = medio;
  }
  return Math.abs(xs[hi]! - x) < Math.abs(x - xs[lo]!) ? hi : lo;
}

/** Fracción de la ventana que salta RePág/AvPág. */
const SALTO = 10;

/** El índice tras una tecla (←/→, Inicio/Fin, RePág/AvPág); null si la tecla no mueve la mira. */
export function indiceTrasTecla(tecla: string, actual: number | null, v: Ventana): number | null {
  const paso = Math.max(1, Math.round((v.hasta - v.desde + 1) / SALTO));
  const dentro = (i: number) => Math.min(v.hasta, Math.max(v.desde, i));
  const desde = actual ?? v.hasta;
  switch (tecla) {
    case "ArrowRight": return actual === null ? v.hasta : dentro(desde + 1);
    case "ArrowLeft": return actual === null ? v.hasta : dentro(desde - 1);
    case "Home": return v.desde;
    case "End": return v.hasta;
    case "PageUp": return dentro(desde - paso);
    case "PageDown": return dentro(desde + paso);
    default: return null;
  }
}
