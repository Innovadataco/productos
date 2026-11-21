/**
 * Asignación FIFO de ventas a lotes (INV-SPEC-12). Puro: sin base de datos.
 * - Los lotes se consumen del más antiguo al más nuevo (fecha de compra, luego id).
 * - Una venta solo consume lotes comprados ese día o antes.
 * - Las asignaciones bloqueadas (fijadas a mano según el portal de A&V) se respetan primero.
 * - El costo de lo vendido es proporcional al costo del lote (sin comisión), a 4 decimales.
 */
import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const ESCALA = 4;

export interface LoteFifo {
  readonly id: string;
  readonly fechaCompra: Date;
  readonly cantidad: bigint;
  readonly costoTotal: Decimal;
}

export interface VentaFifo {
  readonly id: string;
  readonly fecha: Date;
  readonly cantidad: bigint;
}

export interface Asignacion {
  readonly ventaId: string;
  readonly loteId: string;
  readonly cantidad: bigint;
  readonly costoBase: Decimal;
}

export type ResultadoFifo = { ok: true; asignaciones: Asignacion[] } | { ok: false; codigo: "VENTA_SIN_LOTES"; ventaId: string };

const porFecha = <T extends { id: string }>(fecha: (x: T) => Date) => (a: T, b: T) =>
  fecha(a).getTime() - fecha(b).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function costoProporcional(lote: LoteFifo, cantidad: bigint): Decimal {
  return lote.costoTotal.mul(cantidad.toString()).div(lote.cantidad.toString()).toDecimalPlaces(ESCALA, Prisma.Decimal.ROUND_HALF_EVEN);
}

export function asignarFifo(lotes: readonly LoteFifo[], ventas: readonly VentaFifo[], bloqueadas: readonly Asignacion[] = []): ResultadoFifo {
  const disponible = new Map(lotes.map((l) => [l.id, l.cantidad]));
  for (const b of bloqueadas) disponible.set(b.loteId, (disponible.get(b.loteId) ?? 0n) - b.cantidad);
  const yaAsignado = new Map<string, bigint>();
  for (const b of bloqueadas) yaAsignado.set(b.ventaId, (yaAsignado.get(b.ventaId) ?? 0n) + b.cantidad);

  const ordenados = [...lotes].sort(porFecha((l) => l.fechaCompra));
  const asignaciones: Asignacion[] = [];
  for (const venta of [...ventas].sort(porFecha((v) => v.fecha))) {
    let falta = venta.cantidad - (yaAsignado.get(venta.id) ?? 0n);
    for (const lote of ordenados) {
      if (falta <= 0n) break;
      const libre = disponible.get(lote.id) ?? 0n;
      if (libre <= 0n || lote.fechaCompra.getTime() > venta.fecha.getTime()) continue;
      const toma = libre < falta ? libre : falta;
      disponible.set(lote.id, libre - toma);
      falta -= toma;
      asignaciones.push({ ventaId: venta.id, loteId: lote.id, cantidad: toma, costoBase: costoProporcional(lote, toma) });
    }
    if (falta > 0n) return { ok: false, codigo: "VENTA_SIN_LOTES", ventaId: venta.id };
  }
  return { ok: true, asignaciones };
}
