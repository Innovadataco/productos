/**
 * Resultado de una decisión a 30 y 90 días calendario, en pesos, con los cierres guardados. Puro.
 * - «No actuar»: cantidad × (P_h − P_0), desde la fecha de la decisión.
 * - Vender: Σ (totalEstimado − cantidadCompletada × P_h) de sus órdenes, cada una desde su ejecución
 *   (lo que entró neto de comisión frente a lo que valdría haberlas tenido).
 * - Comprar: Σ (cantidadCompletada × P_h − totalEstimado) (lo que valen frente a lo que costaron).
 * P = último cierre en la fecha o antes, sin retroceder más de MAX_RETROCESO_DIAS. Si la fecha
 * objetivo es hoy o después, queda PENDIENTE (el cierre de hoy puede no estar). Sin dividendos en este
 * corte: la salida lo dice (`incluyeDividendos: false`). Mide decisiones pasadas; no recomienda nada.
 */
import { Prisma, type AccionPlan, type EstadoPrecio } from "@prisma/client";
import { ErrorPlan } from "./errores";
import { sumarDias } from "./fechas";

export const HORIZONTES = [30, 90] as const;
export type HorizonteDias = (typeof HORIZONTES)[number];
export const MAX_RETROCESO_DIAS = 7;
export const VERSION_CALCULO = "plan-resultado-v1";

export interface Cierre {
  readonly id: string;
  readonly fecha: Date;
  readonly precio: Prisma.Decimal;
  readonly estado: EstadoPrecio;
  readonly fuente: string;
}

export interface OrdenMedida {
  readonly id: string;
  readonly fechaOperacion: Date;
  readonly cantidadCompletada: bigint;
  readonly totalEstimado: Prisma.Decimal;
}

export interface EntradaResultado {
  readonly accion: AccionPlan;
  readonly fechaDecision: Date;
  readonly cantidad: bigint | null;
  /** Órdenes con enlace vigente a la decisión (solo compra o venta). */
  readonly ordenes: readonly OrdenMedida[];
  /** Cierres vigentes de la especie y de una sola fuente. */
  readonly cierres: readonly Cierre[];
  readonly hoy: Date;
}

export type EstadoTramo = "CALCULADO" | "PENDIENTE" | "SIN_PRECIO";
export type EstadoResultado = EstadoTramo | "SIN_ORDEN";
export type Veredicto = "FUNCIONO" | "NO_FUNCIONO" | "NEUTRO";

export interface Tramo {
  readonly ordenId: string | null;
  readonly fechaBase: Date;
  readonly fechaObjetivo: Date;
  readonly estado: EstadoTramo;
  readonly precioBase: Cierre | null;
  readonly precioObjetivo: Cierre | null;
  readonly resultadoPesos: Prisma.Decimal | null;
}

export interface ResultadoHorizonte {
  readonly horizonteDias: HorizonteDias;
  readonly estado: EstadoResultado;
  readonly resultadoPesos: Prisma.Decimal | null;
  readonly veredicto: Veredicto | null;
  /** Solo si se calculó y todos los cierres usados están VERIFICADO. */
  readonly verificado: boolean;
  readonly tramos: readonly Tramo[];
  readonly incluyeDividendos: false;
  readonly versionCalculo: string;
}

/** Último cierre en `fecha` o antes, dentro del retroceso máximo. */
export function cierreEn(cierres: readonly Cierre[], fecha: Date): Cierre | null {
  const desde = sumarDias(fecha, -MAX_RETROCESO_DIAS);
  return cierres.reduce<Cierre | null>((mejor, c) => {
    if (c.fecha > fecha || c.fecha < desde) return mejor;
    return mejor === null || c.fecha > mejor.fecha ? c : mejor;
  }, null);
}

function tramoNoActuar(e: EntradaResultado, cantidad: bigint, h: HorizonteDias): Tramo {
  const fechaObjetivo = sumarDias(e.fechaDecision, h);
  const vacio = { ordenId: null, fechaBase: e.fechaDecision, fechaObjetivo, precioBase: null, precioObjetivo: null, resultadoPesos: null };
  if (fechaObjetivo >= e.hoy) return { ...vacio, estado: "PENDIENTE" };
  const precioBase = cierreEn(e.cierres, e.fechaDecision);
  const precioObjetivo = cierreEn(e.cierres, fechaObjetivo);
  if (!precioBase || !precioObjetivo) return { ...vacio, estado: "SIN_PRECIO", precioBase, precioObjetivo };
  const resultadoPesos = precioObjetivo.precio.sub(precioBase.precio).mul(cantidad.toString());
  return { ...vacio, estado: "CALCULADO", precioBase, precioObjetivo, resultadoPesos };
}

function tramoOrden(e: EntradaResultado, o: OrdenMedida, h: HorizonteDias): Tramo {
  const fechaObjetivo = sumarDias(o.fechaOperacion, h);
  const vacio = { ordenId: o.id, fechaBase: o.fechaOperacion, fechaObjetivo, precioBase: null, precioObjetivo: null, resultadoPesos: null };
  if (fechaObjetivo >= e.hoy) return { ...vacio, estado: "PENDIENTE" };
  const precioObjetivo = cierreEn(e.cierres, fechaObjetivo);
  if (!precioObjetivo) return { ...vacio, estado: "SIN_PRECIO" };
  const valorTenencia = precioObjetivo.precio.mul(o.cantidadCompletada.toString());
  const resultadoPesos = e.accion === "VENDER" ? o.totalEstimado.sub(valorTenencia) : valorTenencia.sub(o.totalEstimado);
  return { ...vacio, estado: "CALCULADO", precioObjetivo, resultadoPesos };
}

function tramosDe(e: EntradaResultado, h: HorizonteDias): readonly Tramo[] {
  if (e.accion !== "NO_ACTUAR") return [...e.ordenes].sort((a, b) => a.fechaOperacion.getTime() - b.fechaOperacion.getTime()).map((o) => tramoOrden(e, o, h));
  if (e.cantidad === null) throw new ErrorPlan("CANTIDAD_FALTA");
  return [tramoNoActuar(e, e.cantidad, h)];
}

function veredictoDe(pesos: Prisma.Decimal): Veredicto {
  if (pesos.isZero()) return "NEUTRO";
  return pesos.isPositive() ? "FUNCIONO" : "NO_FUNCIONO";
}

export function calcularResultado(e: EntradaResultado, horizonteDias: HorizonteDias): ResultadoHorizonte {
  const tramos = tramosDe(e, horizonteDias);
  const base = { horizonteDias, tramos, incluyeDividendos: false as const, versionCalculo: VERSION_CALCULO };
  const sinCifra = { ...base, resultadoPesos: null, veredicto: null, verificado: false };
  if (tramos.length === 0) return { ...sinCifra, estado: "SIN_ORDEN" };
  if (tramos.some((t) => t.estado === "SIN_PRECIO")) return { ...sinCifra, estado: "SIN_PRECIO" };
  if (tramos.some((t) => t.estado === "PENDIENTE")) return { ...sinCifra, estado: "PENDIENTE" };
  const resultadoPesos = tramos.reduce((suma, t) => suma.add(t.resultadoPesos!), new Prisma.Decimal(0));
  const usados = tramos.flatMap((t) => [t.precioBase, t.precioObjetivo]).filter((c): c is Cierre => c !== null);
  return { ...base, estado: "CALCULADO", resultadoPesos, veredicto: veredictoDe(resultadoPesos), verificado: usados.every((c) => c.estado === "VERIFICADO") };
}

export function calcularResultados(e: EntradaResultado): { readonly d30: ResultadoHorizonte; readonly d90: ResultadoHorizonte } {
  return { d30: calcularResultado(e, 30), d90: calcularResultado(e, 90) };
}
