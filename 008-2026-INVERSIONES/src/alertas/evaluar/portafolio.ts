/**
 * CAIDA_PORTAFOLIO (puro): el valor de lo que se tiene bajó al menos el umbral (inclusivo) frente al cierre anterior.
 * Valor = Σ tenencia × precio, con tenencia bigint y precio Decimal, sin pérdida. Falla cerrada: si una especie con
 * tenencia no tiene precio o cierre anterior, no hay alerta (un valor incompleto daría una caída falsa).
 */
import type { Prisma } from "@prisma/client";
import { claveDeAlerta, type Alerta, type BasePrecio } from "../tipos";
import type { Umbrales } from "../umbrales";
import { aExacto, Exacto, variaAlMenos, variacionPct } from "./exacto";

export interface PosicionCaida {
  readonly instrumentoId: string;
  /** Tenencia de hoy; la que no es positiva no cuenta. */
  readonly tenencia: bigint;
  readonly precio: Prisma.Decimal | null;
  readonly cierreAnterior: Prisma.Decimal | null;
}

export interface EntradaCaida {
  readonly dia: string;
  readonly base: BasePrecio;
  readonly posiciones: readonly PosicionCaida[];
}

export function evaluarCaida(e: EntradaCaida, umbrales: Umbrales): Alerta | null {
  if (!umbrales.alertaCaidaActiva) return null;
  const tenidas = e.posiciones.filter((p) => p.tenencia > 0n);
  if (tenidas.length === 0) return null;
  let actual = new Exacto(0);
  let anterior = new Exacto(0);
  for (const p of tenidas) {
    if (p.precio === null || p.cierreAnterior === null) return null;
    const t = aExacto(p.tenencia);
    actual = actual.add(t.mul(aExacto(p.precio)));
    anterior = anterior.add(t.mul(aExacto(p.cierreAnterior)));
  }
  if (!anterior.gt(0) || !actual.lt(anterior) || !variaAlMenos(actual, anterior, umbrales.alertaCaidaPct)) return null;
  return {
    clave: claveDeAlerta(e.dia, "CAIDA_PORTAFOLIO", null, null, "BAJO"), dia: e.dia, tipo: "CAIDA_PORTAFOLIO",
    instrumentoId: null, reglaId: null, sentido: "BAJO", base: e.base, datos: { variacionPct: variacionPct(actual, anterior) },
  };
}
