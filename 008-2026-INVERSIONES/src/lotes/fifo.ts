/**
 * Asignación FIFO de ventas a lotes (INV-SPEC-12). Puro: sin base de datos.
 * - Los lotes se consumen del más antiguo al más nuevo (fecha de compra, luego id).
 * - Una venta solo consume lotes comprados ese día o antes.
 * - Las asignaciones bloqueadas (fijadas a mano según el portal de A&V) se validan primero con la regla de
 *   coherencia (src/lotes/coherencia.ts) y se respetan: una bloqueada inválida rechaza la especie.
 * - Una bloqueada fija cuánto de ESA venta sale de ESE lote: el FIFO nunca suma al mismo par (venta, lote)
 *   (choca con el único de asignacion_venta) y completa la venta desde otros lotes; si no alcanza, la
 *   venta con bloqueada da BLOQUEADA_INCOMPLETA y la que no tiene, VENTA_SIN_LOTES.
 * - El costo de lo vendido es proporcional al costo del lote (sin comisión), a 4 decimales; la
 *   asignación que agota el lote toma el residual, así la suma de lo asignado iguala su costo. Si con las
 *   bloqueadas ese residual, o lo que le queda al lote, saldría negativo: COSTO_NEGATIVO.
 */
import { Prisma } from "@prisma/client";
import { primerRechazo, sumarPor } from "./coherencia";
import type { Asignacion, CodigoBloqueada, CodigoFifo, LoteFifo, VentaFifo } from "./tipos";

export type { Asignacion, LoteFifo, VentaFifo } from "./tipos";

type Decimal = Prisma.Decimal;
const ESCALA = 4;
const CERO = new Prisma.Decimal(0);

export type ResultadoFifo =
  | { readonly ok: true; readonly asignaciones: Asignacion[] }
  | { readonly ok: false; readonly codigo: "VENTA_SIN_LOTES"; readonly ventaId: string }
  | { readonly ok: false; readonly codigo: CodigoBloqueada | CodigoFifo; readonly ventaId: string | null; readonly loteId: string | null };

const porFecha = <T extends { id: string }>(fecha: (x: T) => Date) => (a: T, b: T) =>
  fecha(a).getTime() - fecha(b).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const par = (ventaId: string, loteId: string) => `${ventaId}\u0000${loteId}`;

export function costoProporcional(lote: LoteFifo, cantidad: bigint): Decimal {
  return lote.costoTotal.mul(cantidad.toString()).div(lote.cantidad.toString()).toDecimalPlaces(ESCALA, Prisma.Decimal.ROUND_HALF_EVEN);
}

/** Lo que le queda a cada lote (cantidad y costo ya asignado) tras las bloqueadas. Mapas propios del cálculo. */
interface Saldo {
  readonly libre: Map<string, bigint>;
  readonly costoAsignado: Map<string, Decimal>;
}

function saldoInicial(lotes: readonly LoteFifo[], bloqueadas: readonly Asignacion[]): Saldo {
  const porLote = sumarPor(bloqueadas, (b) => b.loteId);
  return {
    libre: new Map(lotes.map((l) => [l.id, l.cantidad - (porLote.get(l.id)?.cantidad ?? 0n)])),
    costoAsignado: new Map(lotes.map((l) => [l.id, porLote.get(l.id)?.costo ?? CERO])),
  };
}

/** Asigna lo que le falta a una venta, del lote más antiguo al más nuevo, sin repetir un par bloqueado. */
function completarVenta(venta: VentaFifo, falta: bigint, lotes: readonly LoteFifo[], saldo: Saldo, bloqueados: ReadonlySet<string>) {
  const asignaciones: Asignacion[] = [];
  let pendiente = falta;
  for (const lote of lotes) {
    if (pendiente <= 0n) break;
    const libre = saldo.libre.get(lote.id) ?? 0n;
    if (libre <= 0n || lote.fechaCompra.getTime() > venta.fecha.getTime() || bloqueados.has(par(venta.id, lote.id))) continue;
    const toma = libre < pendiente ? libre : pendiente;
    const previo = saldo.costoAsignado.get(lote.id) ?? CERO;
    const costoBase = toma === libre ? lote.costoTotal.sub(previo) : costoProporcional(lote, toma);
    saldo.libre.set(lote.id, libre - toma);
    saldo.costoAsignado.set(lote.id, previo.add(costoBase));
    pendiente -= toma;
    asignaciones.push({ ventaId: venta.id, loteId: lote.id, cantidad: toma, costoBase });
  }
  return { asignaciones, pendiente };
}

/** COSTO_NEGATIVO: un costo calculado bajo cero, o un lote tocado por el FIFO con más costo asignado que el suyo. */
function costoNegativo(ordenados: readonly LoteFifo[], saldo: Saldo, asignaciones: readonly Asignacion[]): ResultadoFifo | null {
  const negativa = asignaciones.find((a) => a.costoBase.lt(CERO));
  if (negativa) return { ok: false, codigo: "COSTO_NEGATIVO", ventaId: negativa.ventaId, loteId: negativa.loteId };
  const tocados = new Set(asignaciones.map((a) => a.loteId));
  const excedido = ordenados.find((l) => tocados.has(l.id) && (saldo.costoAsignado.get(l.id) ?? CERO).gt(l.costoTotal));
  return excedido ? { ok: false, codigo: "COSTO_NEGATIVO", ventaId: null, loteId: excedido.id } : null;
}

export function asignarFifo(lotes: readonly LoteFifo[], ventas: readonly VentaFifo[], bloqueadas: readonly Asignacion[] = []): ResultadoFifo {
  const rechazo = primerRechazo(lotes, ventas, bloqueadas);
  if (rechazo) return { ok: false, ...rechazo };
  const saldo = saldoInicial(lotes, bloqueadas);
  const fijado = sumarPor(bloqueadas, (b) => b.ventaId);
  const bloqueados = new Set(bloqueadas.map((b) => par(b.ventaId, b.loteId)));
  const ordenados = [...lotes].sort(porFecha((l) => l.fechaCompra));
  const asignaciones: Asignacion[] = [];
  for (const venta of [...ventas].sort(porFecha((v) => v.fecha))) {
    const falta = venta.cantidad - (fijado.get(venta.id)?.cantidad ?? 0n);
    const r = completarVenta(venta, falta, ordenados, saldo, bloqueados);
    asignaciones.push(...r.asignaciones);
    if (r.pendiente > 0n) {
      return fijado.has(venta.id)
        ? { ok: false, codigo: "BLOQUEADA_INCOMPLETA", ventaId: venta.id, loteId: null }
        : { ok: false, codigo: "VENTA_SIN_LOTES", ventaId: venta.id };
    }
  }
  return costoNegativo(ordenados, saldo, asignaciones) ?? { ok: true, asignaciones };
}
