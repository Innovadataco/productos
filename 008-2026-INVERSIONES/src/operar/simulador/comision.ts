/**
 * La comisión de una orden, estimada con la historia del dueño: la suma de las comisiones sobre la suma de los valores
 * sin comisión de sus órdenes aprobadas del mismo lado (todas las especies). 008 no tiene la tarifa de la casa de
 * bolsa: sin órdenes de ese lado no se estima nada, en lugar de inventar una tarifa. La estimación dice de qué lado es
 * y en cuántas órdenes se basa. Puro.
 */
import { Prisma, type LadoOrden } from "@prisma/client";
import { DECIMALES_COMISION, type ComisionEstimada, type OrdenHistorica, type TasaComision } from "./tipos";
import { validarOrdenes } from "./validar";

const CERO = new Prisma.Decimal(0);
const suma = (xs: readonly Prisma.Decimal[]): Prisma.Decimal => xs.reduce((t, x) => t.add(x), CERO);

/** Solo cuentan las aprobadas con valor: una cancelada o en 0 no dice nada de la tarifa. Lanza RangeError con órdenes mal formadas. */
export function tasaComisionHistorica(ordenes: readonly OrdenHistorica[], lado: LadoOrden): TasaComision {
  validarOrdenes(ordenes);
  const base = ordenes.filter((o) => o.lado === lado && o.estado === "APROBADO" && o.totalInvertido.gt(0));
  if (base.length === 0) return { estado: "SIN_HISTORIA" };
  return { estado: "ESTIMABLE", lado, sumaComisiones: suma(base.map((o) => o.comision)), sumaValor: suma(base.map((o) => o.totalInvertido)), ordenesBase: base.length };
}

/**
 * valor × comisiones / valores, redondeado una sola vez al final (4 decimales, mitad hacia arriba): no se redondea una
 * tasa intermedia. El producto y la división llevan las 20 cifras del Decimal de Prisma.
 */
export function estimarComision(valorOrden: Prisma.Decimal, tasa: TasaComision): ComisionEstimada {
  if (tasa.estado === "SIN_HISTORIA") return { estado: "SIN_HISTORIA" };
  const valor = valorOrden.mul(tasa.sumaComisiones).div(tasa.sumaValor).toDecimalPlaces(DECIMALES_COMISION, Prisma.Decimal.ROUND_HALF_UP);
  return { estado: "ESTIMADA", lado: tasa.lado, valor, ordenesBase: tasa.ordenesBase };
}
