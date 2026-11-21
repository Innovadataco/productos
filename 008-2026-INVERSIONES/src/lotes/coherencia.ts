/**
 * Regla de coherencia de las asignaciones de una especie (pura, sin base de datos). La usan el FIFO, antes
 * de calcular, sobre las bloqueadas, y posiciones, al leer, sobre todas las asignaciones guardadas: así lo
 * que la construcción rechaza tampoco entra en las posiciones ni en el tablero.
 * Entrada: los lotes y las ventas (aprobadas, con acciones) de UNA especie, y las asignaciones cuyo lote o
 * cuya venta son de esa especie. Se revisa código por código, en este orden; dentro de cada código, las
 * filas van por (venta, lote) y las sumas por id, así el primer rechazo es siempre el mismo:
 *  1. BLOQUEADA_VENTA_AJENA        la orden no es una venta de la lista (otra especie, una compra, no aprobada)
 *  2. BLOQUEADA_LOTE_AJENO         el lote no es de la especie
 *  3. BLOQUEADA_LOTE_POSTERIOR     el lote se compró después de la venta (el mismo día vale, como en el FIFO)
 *  4. BLOQUEADA_EXCEDE_VENTA       lo asignado a una venta pasa su cantidad
 *  5. BLOQUEADA_EXCEDE_LOTE        lo asignado a un lote pasa su cantidad
 *  6. BLOQUEADA_EXCEDE_COSTO       un lote que no se agota tiene asignado más costo que el suyo (costo vivo < 0)
 *  7. BLOQUEADA_COSTO_DESCUADRADO  un lote agotado no suma su costo total, con ±1 COP de tolerancia (redondeo)
 */
import { Prisma } from "@prisma/client";
import type { Asignacion, CodigoBloqueada, LoteFifo, Rechazo, VentaFifo } from "./tipos";

/** Tolerancia absoluta de la suma de costos de un lote agotado (la misma del efectivo en la conciliación). */
export const TOLERANCIA_COSTO = new Prisma.Decimal(1);

type Fila = (a: Asignacion, lote: LoteFifo | undefined, venta: VentaFifo | undefined) => boolean;

const REGLAS_POR_FILA: ReadonlyArray<readonly [CodigoBloqueada, Fila]> = [
  ["BLOQUEADA_VENTA_AJENA", (_a, _l, v) => v === undefined],
  ["BLOQUEADA_LOTE_AJENO", (_a, l) => l === undefined],
  ["BLOQUEADA_LOTE_POSTERIOR", (_a, l, v) => l !== undefined && v !== undefined && l.fechaCompra.getTime() > v.fecha.getTime()],
];

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const porPar = (a: Asignacion, b: Asignacion) => comparar(a.ventaId, b.ventaId) || comparar(a.loteId, b.loteId);

interface Suma {
  readonly cantidad: bigint;
  readonly costo: Prisma.Decimal;
}

/** Suma cantidad y costo por clave (venta o lote), sin mutar las filas. */
export function sumarPor(filas: readonly Asignacion[], clave: (a: Asignacion) => string): ReadonlyMap<string, Suma> {
  return filas.reduce((m, a) => {
    const previa = m.get(clave(a)) ?? { cantidad: 0n, costo: new Prisma.Decimal(0) };
    return m.set(clave(a), { cantidad: previa.cantidad + a.cantidad, costo: previa.costo.add(a.costoBase) });
  }, new Map<string, Suma>());
}

function porFila(filas: readonly Asignacion[], lotes: ReadonlyMap<string, LoteFifo>, ventas: ReadonlyMap<string, VentaFifo>): Rechazo | null {
  for (const [codigo, falla] of REGLAS_POR_FILA) {
    const f = filas.find((a) => falla(a, lotes.get(a.loteId), ventas.get(a.ventaId)));
    if (f) return { codigo, ventaId: f.ventaId, loteId: f.loteId };
  }
  return null;
}

function porVenta(filas: readonly Asignacion[], ventas: readonly VentaFifo[]): Rechazo | null {
  const sumas = sumarPor(filas, (a) => a.ventaId);
  const v = [...ventas].sort((a, b) => comparar(a.id, b.id)).find((x) => (sumas.get(x.id)?.cantidad ?? 0n) > x.cantidad);
  return v ? { codigo: "BLOQUEADA_EXCEDE_VENTA", ventaId: v.id, loteId: null } : null;
}

const REGLAS_POR_LOTE: ReadonlyArray<readonly [CodigoBloqueada, (l: LoteFifo, s: Suma) => boolean]> = [
  ["BLOQUEADA_EXCEDE_LOTE", (l, s) => s.cantidad > l.cantidad],
  ["BLOQUEADA_EXCEDE_COSTO", (l, s) => s.cantidad < l.cantidad && s.costo.gt(l.costoTotal)],
  ["BLOQUEADA_COSTO_DESCUADRADO", (l, s) => s.cantidad === l.cantidad && s.costo.sub(l.costoTotal).abs().gt(TOLERANCIA_COSTO)],
];

function porLote(filas: readonly Asignacion[], lotes: readonly LoteFifo[]): Rechazo | null {
  const sumas = sumarPor(filas, (a) => a.loteId);
  const ordenados = [...lotes].sort((a, b) => comparar(a.id, b.id));
  for (const [codigo, falla] of REGLAS_POR_LOTE) {
    const l = ordenados.find((x) => {
      const s = sumas.get(x.id);
      return s !== undefined && falla(x, s);
    });
    if (l) return { codigo, ventaId: null, loteId: l.id };
  }
  return null;
}

/** El primer rechazo de las asignaciones de una especie, o null si cuadran. */
export function primerRechazo(lotes: readonly LoteFifo[], ventas: readonly VentaFifo[], asignaciones: readonly Asignacion[]): Rechazo | null {
  const filas = [...asignaciones].sort(porPar);
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const ventaPorId = new Map(ventas.map((v) => [v.id, v]));
  return porFila(filas, lotePorId, ventaPorId) ?? porVenta(filas, ventas) ?? porLote(filas, lotes);
}

/** Ventas cuya cantidad asignada no es exactamente la vendida (sin asignar del todo o en parte). */
export function ventasSinCuadrar(ventas: readonly VentaFifo[], asignaciones: readonly Asignacion[]): string[] {
  const sumas = sumarPor(asignaciones, (a) => a.ventaId);
  return ventas.filter((v) => (sumas.get(v.id)?.cantidad ?? 0n) !== v.cantidad).map((v) => v.id);
}
