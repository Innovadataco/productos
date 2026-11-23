/**
 * El control de la tarifa (O5): «la tarifa explica X de N órdenes pasadas». Para cada orden aprobada con valor del lado
 * de la tarifa, compara lo que cobraría la tarifa (comisión + IVA + otros cargos, sobre el valor sin comisión) con la
 * comisión real de `orden.comision`, con la tolerancia de TOLERANCIA_CONTROL_PESOS por orden. Es información: no
 * corrige ni la tarifa ni las órdenes. Las órdenes de 008 son todas de Trii (las cargas de órdenes son TRII_ORDENES):
 * para A&V no hay con qué contrastar. Puro.
 */
import { Prisma } from "@prisma/client";
import { comisionConTarifa } from "../simulador/tarifa";
import type { OrdenHistorica, TarifaSimulada } from "../simulador/tipos";
import { TOLERANCIA_CONTROL_PESOS } from "./parametros";

const TOLERANCIA = new Prisma.Decimal(TOLERANCIA_CONTROL_PESOS);

export type ControlTarifa =
  | { readonly estado: "SIN_ORDENES" }
  | { readonly estado: "CONTRASTADA"; readonly explicadas: number; readonly total: number };

/** Lo explica si la diferencia, en valor absoluto, no pasa la tolerancia. */
export const explica = (tarifa: TarifaSimulada, orden: OrdenHistorica): boolean =>
  comisionConTarifa(orden.totalInvertido, tarifa).sub(orden.comision).abs().lte(TOLERANCIA);

/** Desde el `vigenteDesde` de la versión (inclusive) y hasta el de la versión siguiente (exclusive; null = sin siguiente). */
const mientrasRige = (tarifa: TarifaSimulada, hasta: Date | null) => (o: OrdenHistorica): boolean =>
  o.fecha.getTime() >= tarifa.vigenteDesde.getTime() && (hasta === null || o.fecha.getTime() < hasta.getTime());

/** Cada versión se compara solo con las órdenes de mientras rige: una orden de antes se cobró con otra tarifa. */
export function controlarTarifa(tarifa: TarifaSimulada, ordenes: readonly OrdenHistorica[], hasta: Date | null = null): ControlTarifa {
  if (tarifa.comisionista !== "TRII") return { estado: "SIN_ORDENES" };
  const base = ordenes.filter((o) => o.lado === tarifa.lado && o.estado === "APROBADO" && o.totalInvertido.gt(0)).filter(mientrasRige(tarifa, hasta));
  if (base.length === 0) return { estado: "SIN_ORDENES" };
  return { estado: "CONTRASTADA", explicadas: base.filter((o) => explica(tarifa, o)).length, total: base.length };
}
