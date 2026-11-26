/**
 * MOVIMIENTO_DIA (puro): el precio de la especie se movió al menos el umbral (inclusivo) frente al cierre anterior.
 * Sin precio o sin cierre anterior no salta. La comparación es exacta (sin dividir). El día de la fecha ex no se suprime:
 * la alerta lo lleva en `esFechaEx` y el texto lo dice (un dividendo explica parte de la baja).
 */
import { claveDeAlerta, type Alerta, type PrecioEvaluado } from "../tipos";
import type { Umbrales } from "../umbrales";
import type { Prisma } from "@prisma/client";
import { aExacto, variaAlMenos, variacionPct } from "./exacto";

export interface EntradaMovimiento {
  readonly dia: string;
  readonly instrumentoId: string;
  readonly precio: PrecioEvaluado | null;
  /** Cierre del día hábil anterior. */
  readonly cierreAnterior: Prisma.Decimal | null;
  /** Hoy es fecha ex de un decreto vigente de la especie. */
  readonly diaEsFechaEx: boolean;
}

export function evaluarMovimiento(e: EntradaMovimiento, umbrales: Umbrales): Alerta | null {
  if (!umbrales.alertaMovimientoActiva || e.precio === null || e.cierreAnterior === null) return null;
  const actual = aExacto(e.precio.precio);
  const anterior = aExacto(e.cierreAnterior);
  if (!actual.gt(0) || !anterior.gt(0) || !variaAlMenos(actual, anterior, umbrales.alertaMovimientoPct)) return null;
  const sentido = actual.gt(anterior) ? "SOBRE" : "BAJO";
  return {
    clave: claveDeAlerta(e.dia, "MOVIMIENTO_DIA", e.instrumentoId, null, sentido), dia: e.dia, tipo: "MOVIMIENTO_DIA",
    instrumentoId: e.instrumentoId, reglaId: null, sentido, base: e.precio.base,
    datos: { precio: e.precio.precio, variacionPct: variacionPct(actual, anterior), instante: e.precio.instante, conRetraso: e.precio.conRetraso, esFechaEx: e.diaEsFechaEx },
  };
}
