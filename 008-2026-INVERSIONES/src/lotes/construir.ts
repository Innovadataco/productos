/**
 * Construye los lotes y las asignaciones de venta desde las órdenes importadas (INV-SPEC-12).
 * Idempotente: se puede correr después de cada importación.
 * - Un lote por orden de COMPRA aprobada con acciones completadas (costo de Trii, sin comisión).
 * - Las asignaciones de venta NO bloqueadas se recalculan con FIFO por especie (una compra
 *   importada después con fecha anterior cambia la asignación; las bloqueadas se respetan).
 * - Si las ventas de una especie no caben en sus lotes, esa especie queda sin asignaciones y se
 *   informa (VENTA_SIN_LOTES): nunca se inventa una posición negativa.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { asignarFifo, type Asignacion } from "./fifo";

type Tx = Prisma.TransactionClient;

export interface ResultadoConstruccion {
  readonly lotesCreados: number;
  readonly especiesConVentas: number;
  readonly asignacionesRecalculadas: number;
  /** Ids de instrumento cuyas ventas no caben en sus lotes (falta un lote, p. ej. de escisión). */
  readonly especiesSinLotes: readonly string[];
}

async function crearLotesDeCompras(tx: Tx): Promise<number> {
  const compras = await tx.orden.findMany({
    where: { lado: "COMPRA", estado: "APROBADO", cantidadCompletada: { gt: 0n }, lote: null },
  });
  for (const o of compras) {
    await tx.lote.create({
      data: {
        instrumentoId: o.instrumentoId, origen: "COMPRA", ordenId: o.id, fechaCompra: o.fechaOperacion,
        fechaLiquidacion: o.fechaLiquidacion, cantidad: o.cantidadCompletada, costoUnitario: o.precioUnitario,
        costoTotal: o.totalInvertido, comision: o.comision, fuenteCosto: "TRII_ORDEN",
      },
    });
  }
  return compras.length;
}

async function reasignarVentas(tx: Tx, instrumentoId: string): Promise<Asignacion[] | null> {
  const [lotes, ventas, bloqueadas] = await Promise.all([
    tx.lote.findMany({ where: { instrumentoId }, select: { id: true, fechaCompra: true, cantidad: true, costoTotal: true } }),
    tx.orden.findMany({ where: { instrumentoId, lado: "VENTA", estado: "APROBADO", cantidadCompletada: { gt: 0n } }, select: { id: true, fechaOperacion: true, cantidadCompletada: true } }),
    tx.asignacionVenta.findMany({ where: { lote: { instrumentoId }, bloqueada: true } }),
  ]);
  await tx.asignacionVenta.deleteMany({ where: { lote: { instrumentoId }, bloqueada: false } });
  const r = asignarFifo(
    lotes,
    ventas.map((v) => ({ id: v.id, fecha: v.fechaOperacion, cantidad: v.cantidadCompletada })),
    bloqueadas.map((b) => ({ ventaId: b.ordenVentaId, loteId: b.loteId, cantidad: b.cantidad, costoBase: b.costoBase })),
  );
  if (!r.ok) return null;
  for (const a of r.asignaciones) {
    await tx.asignacionVenta.create({ data: { ordenVentaId: a.ventaId, loteId: a.loteId, cantidad: a.cantidad, costoBase: a.costoBase, metodo: "FIFO" } });
  }
  return r.asignaciones;
}

export async function construirLotes(db: PrismaClient): Promise<ResultadoConstruccion> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inv008-construir-lotes'))`;
      const lotesCreados = await crearLotesDeCompras(tx);
      const conVentas = await tx.orden.findMany({
        where: { lado: "VENTA", estado: "APROBADO", cantidadCompletada: { gt: 0n } },
        distinct: ["instrumentoId"], select: { instrumentoId: true },
      });
      let asignacionesRecalculadas = 0;
      const especiesSinLotes: string[] = [];
      for (const { instrumentoId } of conVentas) {
        const asignadas = await reasignarVentas(tx, instrumentoId);
        if (asignadas === null) especiesSinLotes.push(instrumentoId);
        else asignacionesRecalculadas += asignadas.length;
      }
      return { lotesCreados, especiesConVentas: conVentas.length, asignacionesRecalculadas, especiesSinLotes };
    },
    { timeout: 60_000 },
  );
}
