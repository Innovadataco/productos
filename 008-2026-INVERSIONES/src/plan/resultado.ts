/**
 * Resultado de una decisión a 30 y 90 días calendario, en pesos, con los cierres guardados y los dividendos. Puro.
 * Precio (fórmula aprobada en el corte 1, sin cambios):
 * - «No actuar»: cantidad × (P_h − P_0), desde la fecha de la decisión (se mide como mantener esas acciones).
 * - Vender: Σ (totalEstimado − cantidadCompletada × P_h) de sus órdenes, cada una desde su ejecución
 *   (lo que entró neto de comisión frente a lo que valdría haberlas tenido).
 * - Comprar: Σ (cantidadCompletada × P_h − totalEstimado) (lo que valen frente a lo que costaron).
 * P = último cierre en la fecha o antes, sin retroceder más de MAX_RETROCESO_DIAS. Si la fecha objetivo es hoy o
 * después, queda PENDIENTE (el cierre de hoy puede no estar).
 * Dividendos (corte 3, `dividendos.ts`): los pagados en (base, objetivo] de cada tramo, prorrateados por la
 * tenencia; suman en comprar y «no actuar» y restan en vender (lo que dejó de recibir). Todo o nada por horizonte:
 * si un tramo no se puede medir, el horizonte queda solo con el precio y dice por qué. Si la especie tuvo una
 * escisión dentro de la ventana, el precio cae por la escisión: se avisa y no hay veredicto.
 * Mide decisiones pasadas; no recomienda nada.
 */
import { Prisma, type AccionPlan, type EstadoPrecio } from "@prisma/client";
import { dividendosDelTramo, type ContextoEspecie, type DividendosTramo, type MotivoSinDividendos } from "./dividendos";
import { ErrorPlan } from "./errores";
import { sumarDias } from "./fechas";

export const HORIZONTES = [30, 90] as const;
export type HorizonteDias = (typeof HORIZONTES)[number];
export const MAX_RETROCESO_DIAS = 7;
export const VERSION_CALCULO = "plan-resultado-v2";

/** Los dividendos suman lo que se tuvo y restan lo que se vendió. */
const SIGNO_DIVIDENDOS: Readonly<Record<AccionPlan, 1 | -1>> = { COMPRAR: 1, NO_ACTUAR: 1, VENDER: -1 };

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
  /** Tenencia, dividendos, cobertura de las cargas y escisiones de la especie. */
  readonly especie: ContextoEspecie;
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
  /** Solo el precio, con su signo. */
  readonly resultadoPrecio: Prisma.Decimal | null;
  /** Solo en un tramo CALCULADO. Los montos van sin signo. */
  readonly dividendos: DividendosTramo | null;
}

export interface ResultadoHorizonte {
  readonly horizonteDias: HorizonteDias;
  readonly estado: EstadoResultado;
  readonly resultadoPrecio: Prisma.Decimal | null;
  /** Con signo; null si no se calculó o no se pudieron medir. */
  readonly dividendosPesos: Prisma.Decimal | null;
  /** Precio + dividendos; si los dividendos no se pudieron medir, solo el precio. */
  readonly resultadoPesos: Prisma.Decimal | null;
  /** null si no se calculó o si hubo una escisión de la especie en la ventana. */
  readonly veredicto: Veredicto | null;
  /** Solo si se calculó y todos los cierres usados están VERIFICADO (los dividendos son del archivo de Trii). */
  readonly verificado: boolean;
  readonly incluyeDividendos: boolean;
  readonly motivoSinDividendos: MotivoSinDividendos | null;
  readonly escisionEnVentana: boolean;
  readonly tramos: readonly Tramo[];
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
  const vacio = { ordenId: null, fechaBase: e.fechaDecision, fechaObjetivo, precioBase: null, precioObjetivo: null, resultadoPrecio: null, dividendos: null };
  if (fechaObjetivo >= e.hoy) return { ...vacio, estado: "PENDIENTE" };
  const precioBase = cierreEn(e.cierres, e.fechaDecision);
  const precioObjetivo = cierreEn(e.cierres, fechaObjetivo);
  if (!precioBase || !precioObjetivo) return { ...vacio, estado: "SIN_PRECIO", precioBase, precioObjetivo };
  const resultadoPrecio = precioObjetivo.precio.sub(precioBase.precio).mul(cantidad.toString());
  const dividendos = dividendosDelTramo(e.especie, e.fechaDecision, fechaObjetivo, cantidad);
  return { ...vacio, estado: "CALCULADO", precioBase, precioObjetivo, resultadoPrecio, dividendos };
}

function tramoOrden(e: EntradaResultado, o: OrdenMedida, h: HorizonteDias): Tramo {
  const fechaObjetivo = sumarDias(o.fechaOperacion, h);
  const vacio = { ordenId: o.id, fechaBase: o.fechaOperacion, fechaObjetivo, precioBase: null, precioObjetivo: null, resultadoPrecio: null, dividendos: null };
  if (fechaObjetivo >= e.hoy) return { ...vacio, estado: "PENDIENTE" };
  const precioObjetivo = cierreEn(e.cierres, fechaObjetivo);
  if (!precioObjetivo) return { ...vacio, estado: "SIN_PRECIO" };
  const valorTenencia = precioObjetivo.precio.mul(o.cantidadCompletada.toString());
  const resultadoPrecio = e.accion === "VENDER" ? o.totalEstimado.sub(valorTenencia) : valorTenencia.sub(o.totalEstimado);
  const dividendos = dividendosDelTramo(e.especie, o.fechaOperacion, fechaObjetivo, o.cantidadCompletada);
  return { ...vacio, estado: "CALCULADO", precioObjetivo, resultadoPrecio, dividendos };
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

const sumar = (valores: readonly Prisma.Decimal[]): Prisma.Decimal => valores.reduce((s, v) => s.add(v), new Prisma.Decimal(0));

/** Los dividendos del horizonte: todos medibles, o ninguno (con el motivo del primer tramo que no lo es). */
function dividendosDelHorizonte(tramos: readonly Tramo[], accion: AccionPlan): { readonly pesos: Prisma.Decimal | null; readonly motivo: MotivoSinDividendos | null } {
  const totales: Prisma.Decimal[] = [];
  for (const t of tramos) {
    if (!t.dividendos?.medible) return { pesos: null, motivo: t.dividendos?.medible === false ? t.dividendos.motivo : null };
    totales.push(t.dividendos.total);
  }
  return { pesos: sumar(totales).mul(SIGNO_DIVIDENDOS[accion]), motivo: null };
}

const escisionEn = (tramos: readonly Tramo[], escisiones: readonly Date[]): boolean =>
  tramos.some((t) => escisiones.some((f) => f > t.fechaBase && f <= t.fechaObjetivo));

export function calcularResultado(e: EntradaResultado, horizonteDias: HorizonteDias): ResultadoHorizonte {
  const tramos = tramosDe(e, horizonteDias);
  const base = { horizonteDias, tramos, versionCalculo: VERSION_CALCULO };
  const sinCifra = { ...base, resultadoPrecio: null, dividendosPesos: null, resultadoPesos: null, veredicto: null, verificado: false, incluyeDividendos: false, motivoSinDividendos: null, escisionEnVentana: false };
  if (tramos.length === 0) return { ...sinCifra, estado: "SIN_ORDEN" };
  if (tramos.some((t) => t.estado === "SIN_PRECIO")) return { ...sinCifra, estado: "SIN_PRECIO" };
  if (tramos.some((t) => t.estado === "PENDIENTE")) return { ...sinCifra, estado: "PENDIENTE" };
  const resultadoPrecio = sumar(tramos.map((t) => t.resultadoPrecio!));
  const dividendos = dividendosDelHorizonte(tramos, e.accion);
  const resultadoPesos = dividendos.pesos === null ? resultadoPrecio : resultadoPrecio.add(dividendos.pesos);
  const escisionEnVentana = escisionEn(tramos, e.especie.escisiones);
  const usados = tramos.flatMap((t) => [t.precioBase, t.precioObjetivo]).filter((c): c is Cierre => c !== null);
  return {
    ...base,
    estado: "CALCULADO",
    resultadoPrecio,
    dividendosPesos: dividendos.pesos,
    resultadoPesos,
    veredicto: escisionEnVentana ? null : veredictoDe(resultadoPesos),
    verificado: usados.every((c) => c.estado === "VERIFICADO"),
    incluyeDividendos: dividendos.pesos !== null,
    motivoSinDividendos: dividendos.motivo,
    escisionEnVentana,
  };
}

export function calcularResultados(e: EntradaResultado): { readonly d30: ResultadoHorizonte; readonly d90: ResultadoHorizonte } {
  return { d30: calcularResultado(e, 30), d90: calcularResultado(e, 90) };
}
