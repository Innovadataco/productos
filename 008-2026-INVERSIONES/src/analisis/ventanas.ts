/**
 * Rendimiento de una especie en ventanas de 1, 3, 6 y 12 meses, sobre su historia propia (una sola columna). Puro.
 * - Fin: el último día de su historia (su último cierre). Base: la última rueda con cierre en o antes del mismo día
 *   `meses` meses antes (restarMeses). Si la historia no llega a la base, HISTORIA_NO_ALCANZA.
 * - Precio: Π factores − 1 (ajustados por escisiones y saltos, src/proyecciones/ajustes.ts). Total: Π (factor +
 *   dividendo del día / precio del día anterior) − 1, el dividendo reinvertido el día del pago, como la historia de las
 *   proyecciones. Limitación conocida: si la fecha ex cae dentro y el pago fuera, el total queda por debajo.
 */
import { primerIndiceDesde } from "../proyecciones/ajustes";
import type { Historia } from "../proyecciones/tipos";
import { restarMeses } from "./dias";
import { redondear } from "./numeros";
import type { VentanaDe, VentanaMeses, Ventanas } from "./tipos";

function unaColumna(h: Historia): void {
  if (h.K !== 1) throw new RangeError("La historia propia tiene una sola columna.");
}

/** Índice acumulado desde el primer día: 1 y después Π de `paso(t)`. */
const acumular = (h: Historia, paso: (t: number) => number): number[] => {
  const indice = [1];
  for (let t = 0; t < h.T; t += 1) indice.push(indice[t]! * paso(t));
  return indice;
};

/** Índice del precio ajustado: 1 el primer día y después Π factores. */
export function indicePrecio(h: Historia): number[] {
  unaColumna(h);
  return acumular(h, (t) => h.factores[t]!);
}

/** Las cuatro ventanas de VENTANAS_MESES (tipos.ts), en ese orden. */
export function rendimientosEnVentanas(h: Historia): Ventanas {
  const precio = indicePrecio(h);
  const total = acumular(h, (t) => h.factores[t]! + h.rendimientos[t]!);
  const fin = h.dias.length - 1;
  const hasta = h.dias[fin]!;
  const ventana = <M extends VentanaMeses>(meses: M): VentanaDe<M> => {
    // La última rueda ≤ objetivo: la anterior a la primera > objetivo.
    const base = primerIndiceDesde(h.dias, restarMeses(hasta, meses) + "\u0000") - 1;
    if (base < 0) return { meses, estado: "HISTORIA_NO_ALCANZA" };
    return {
      meses, estado: "CALCULADA", desde: h.dias[base]!, hasta, ruedas: fin - base,
      precio: redondear(precio[fin]! / precio[base]! - 1), total: redondear(total[fin]! / total[base]! - 1),
    };
  };
  return [ventana(1), ventana(3), ventana(6), ventana(12)];
}
