/**
 * El mes del tope de gasto de la nube, en hora de Colombia (UTC−5 todo el año: sin horario de verano), como el rango
 * semiabierto [desde, hasta) que pide `gastoDelMes`. Puro.
 */
import type { DiaIso } from "../contrato";
import { esDiaIso } from "../formas";
import { ErrorRegistro } from "./fila";

/** El desfase de Colombia frente a UTC, fijo. */
const DESFASE_COLOMBIA = "-05:00";

export interface RangoMes {
  readonly desde: Date;
  readonly hasta: Date;
}

const inicioDeMes = (anio: number, mes: number): Date =>
  new Date(`${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01T00:00:00.000${DESFASE_COLOMBIA}`);

/** [primer día del mes de `dia` a las 00:00 de Colombia, primer día del mes siguiente a las 00:00 de Colombia). */
export function rangoDelMes(dia: DiaIso): RangoMes {
  if (typeof dia !== "string" || !esDiaIso(dia)) throw new ErrorRegistro("RANGO_INVALIDO");
  const anio = Number(dia.slice(0, 4));
  const mes = Number(dia.slice(5, 7));
  return Object.freeze({ desde: inicioDeMes(anio, mes), hasta: mes === 12 ? inicioDeMes(anio + 1, 1) : inicioDeMes(anio, mes + 1) });
}
