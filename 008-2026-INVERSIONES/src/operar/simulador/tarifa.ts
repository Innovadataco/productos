/**
 * La comisión de una orden con la tarifa real que cargó el dueño (O5, `tarifa_comision`). Puro y exacto (Decimal):
 * - comisión = max(valor × porcentaje / 100, mínimo por orden) + fijo por orden;
 * - IVA = comisión × IVA / 100 (solo sobre la comisión);
 * - otros cargos: un PCT es valor × porcentaje / 100 y un FIJO, su valor (sin IVA);
 * - total = comisión + IVA + otros, redondeado una sola vez al final a 4 decimales (mitad hacia arriba), la escala de
 *   `orden.comision`. Las partes del desglose van sin redondear.
 */
import { Prisma } from "@prisma/client";
import { DECIMALES_COMISION, type TarifaSimulada } from "./tipos";

type Decimal = Prisma.Decimal;
const CERO = new Prisma.Decimal(0);
const CIEN = new Prisma.Decimal(100);

export interface DesgloseTarifa {
  readonly comision: Decimal;
  readonly iva: Decimal;
  readonly otros: Decimal;
  /** comisión + IVA + otros, a 4 decimales. */
  readonly total: Decimal;
}

const pct = (base: Decimal, porcentaje: Decimal): Decimal => base.mul(porcentaje).div(CIEN);

export function desgloseConTarifa(valorOrden: Decimal, tarifa: TarifaSimulada): DesgloseTarifa {
  const comision = Prisma.Decimal.max(pct(valorOrden, tarifa.porcentaje), tarifa.minimoPorOrden).add(tarifa.fijoPorOrden);
  const iva = pct(comision, tarifa.ivaPct);
  const otros = tarifa.otrosCargos.reduce((t, c) => t.add(c.tipo === "PCT" ? pct(valorOrden, c.valor) : c.valor), CERO);
  const total = comision.add(iva).add(otros).toDecimalPlaces(DECIMALES_COMISION, Prisma.Decimal.ROUND_HALF_UP);
  return { comision, iva, otros, total };
}

/** El total que cobra la tarifa por una orden de ese valor (comisión, IVA y otros cargos), a 4 decimales. */
export const comisionConTarifa = (valorOrden: Decimal, tarifa: TarifaSimulada): Decimal => desgloseConTarifa(valorOrden, tarifa).total;
