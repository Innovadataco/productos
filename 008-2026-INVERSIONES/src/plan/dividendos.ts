/**
 * Dividendos atribuidos a un tramo de una decisión (fase B, corte 3). Puro.
 * La base guarda lo que pagó Trii (neto, por toda la tenencia) y no la fecha ex ni el valor por acción
 * (nadie llena `dividendo_decretado` todavía). Por eso el valor por acción se deriva:
 *   por acción = montoNeto / tenencia el día del pago;  atribuido = montoNeto × cantidad / tenencia (4 decimales).
 * Entran los pagos con fecha en (base, objetivo] que no son la fracción de una escisión (esa es ganancia realizada).
 * Cuando no se puede saber qué le tocaba a la cantidad medida, el tramo NO es medible y se dice por qué:
 *   - ESCISION_SIN_LOTE: la especie salió de una escisión sin su lote: la tenencia está incompleta.
 *   - CARGA_NO_CUBRE: el objetivo es posterior a lo que llegan las cargas de Trii (órdenes y dividendos).
 *   - SIN_TENENCIA: algún día de la ventana no hubo acciones (p. ej. se vendió todo): no se sabe qué pagó la especie.
 *   - TENENCIA_CAMBIA_CERCA_DEL_PAGO: hubo compras o ventas en los VENTANA_EX_DIAS anteriores a un pago. Es una
 *     APROXIMACIÓN de la fecha ex (que la base no tiene): el periodo ex de la BVC está por verificar.
 * Mide decisiones pasadas; no recomienda nada.
 */
import { Prisma, type TipoDividendo } from "@prisma/client";
import { sumarDias } from "./fechas";
import { constanteEn, positivaEn, tenenciaEn, type MovimientoTenencia } from "./tenencia";

/** Días calendario antes de un pago en que la tenencia debe quedar quieta (aproximación de la fecha ex). */
export const VENTANA_EX_DIAS = 10;
const DECIMALES_ATRIBUIDO = 4;
const DECIMALES_POR_ACCION = 6;

export type MotivoSinDividendos = "ESCISION_SIN_LOTE" | "CARGA_NO_CUBRE" | "SIN_TENENCIA" | "TENENCIA_CAMBIA_CERCA_DEL_PAGO";

export interface DividendoPagado {
  readonly id: string;
  readonly fechaPago: Date;
  /** Lo que pagó Trii por toda la tenencia, neto de retención. */
  readonly montoNeto: Prisma.Decimal;
  readonly tipo: TipoDividendo;
}

/** Lo que se sabe de la especie para medir sus dividendos (lo arma `resultados-lote.ts`). */
export interface ContextoEspecie {
  readonly dividendos: readonly DividendoPagado[];
  readonly movimientos: readonly MovimientoTenencia[];
  /** Hasta qué fecha llegan las cargas de Trii de órdenes Y de dividendos; null si falta alguna. */
  readonly cubiertoHasta: Date | null;
  readonly destinoSinLote: boolean;
  /** Fechas de las escisiones en que la especie es el origen. */
  readonly escisiones: readonly Date[];
}

export interface DividendoAtribuido {
  readonly dividendoId: string;
  readonly fechaPago: Date;
  readonly montoNeto: Prisma.Decimal;
  readonly tenencia: bigint;
  readonly porAccion: Prisma.Decimal;
  /** Sin signo: el signo lo pone la acción de la decisión. */
  readonly atribuido: Prisma.Decimal;
}

export type DividendosTramo =
  | { readonly medible: true; readonly atribuidos: readonly DividendoAtribuido[]; readonly total: Prisma.Decimal }
  | { readonly medible: false; readonly motivo: MotivoSinDividendos };

function motivoGeneral(ctx: ContextoEspecie, base: Date, objetivo: Date): MotivoSinDividendos | null {
  if (ctx.destinoSinLote) return "ESCISION_SIN_LOTE";
  if (ctx.cubiertoHasta === null || objetivo > ctx.cubiertoHasta) return "CARGA_NO_CUBRE";
  return positivaEn(ctx.movimientos, base, objetivo) ? null : "SIN_TENENCIA";
}

function atribuir(d: DividendoPagado, movimientos: readonly MovimientoTenencia[], cantidad: bigint): DividendoAtribuido {
  const tenencia = tenenciaEn(movimientos, d.fechaPago);
  const t = tenencia.toString();
  return {
    dividendoId: d.id,
    fechaPago: d.fechaPago,
    montoNeto: d.montoNeto,
    tenencia,
    porAccion: d.montoNeto.div(t).toDecimalPlaces(DECIMALES_POR_ACCION, Prisma.Decimal.ROUND_HALF_UP),
    atribuido: d.montoNeto.mul(cantidad.toString()).div(t).toDecimalPlaces(DECIMALES_ATRIBUIDO, Prisma.Decimal.ROUND_HALF_UP),
  };
}

export function dividendosDelTramo(ctx: ContextoEspecie, base: Date, objetivo: Date, cantidad: bigint): DividendosTramo {
  const general = motivoGeneral(ctx, base, objetivo);
  if (general) return { medible: false, motivo: general };
  const pagos = ctx.dividendos
    .filter((d) => d.tipo !== "FRACCION_ESCISION" && d.fechaPago > base && d.fechaPago <= objetivo)
    .sort((a, b) => a.fechaPago.getTime() - b.fechaPago.getTime() || (a.id < b.id ? -1 : 1));
  if (pagos.some((d) => !constanteEn(ctx.movimientos, sumarDias(d.fechaPago, -VENTANA_EX_DIAS), d.fechaPago))) {
    return { medible: false, motivo: "TENENCIA_CAMBIA_CERCA_DEL_PAGO" };
  }
  const atribuidos = pagos.map((d) => atribuir(d, ctx.movimientos, cantidad));
  return { medible: true, atribuidos, total: atribuidos.reduce((s, a) => s.add(a.atribuido), new Prisma.Decimal(0)) };
}
