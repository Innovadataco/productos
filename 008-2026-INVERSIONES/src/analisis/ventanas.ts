/**
 * Rendimiento de una especie en ventanas de 1, 3, 6 y 12 meses, sobre su historia propia (una sola columna). Puro.
 * - Fin: el último día de su historia (su último cierre). Base: la última rueda con cierre en o antes del mismo día
 *   `meses` meses antes (restarMeses). Si la historia no llega a la base, HISTORIA_NO_ALCANZA.
 * - Precio: Π factores − 1 (ajustados por escisiones y saltos, src/proyecciones/ajustes.ts). Total: Π (factor +
 *   dividendo del día / precio del día anterior) − 1, el dividendo reinvertido el día del pago, como la historia de las
 *   proyecciones. Limitación conocida: si la fecha ex cae dentro y el pago fuera, el total queda por debajo.
 */
import type { Historia } from "../proyecciones/tipos";
import type { VentanaRendimiento } from "./tipos";

export function rendimientosEnVentanas(h: Historia): readonly VentanaRendimiento[] {
  throw new Error("sin implementar");
}

/** Índice del precio ajustado: 1 el primer día y después Π factores. */
export function indicePrecio(h: Historia): number[] {
  throw new Error("sin implementar");
}
