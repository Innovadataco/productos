/**
 * Lee la base y arma las entradas de la evolución del tablero (frente graficas-tablero). Solo lectura.
 * El universo es el del tablero ya leído (vivas y cerradas, sin las incompletas) y la serie llega hasta su fecha de
 * referencia: así el último punto cuadra con «Valor en acciones», salvo que entre una carga entre la lectura del
 * tablero y esta (son dos fotos; en una app de un solo dueño, la siguiente visita ya cuadra). Una consulta por tabla
 * (nunca una por especie) y las cuatro en la misma foto (REPEATABLE READ), como src/lotes/posiciones.ts. Es un
 * $transaction de arreglo: Prisma 5 no le aplica maxWait ni timeout (son de las transacciones interactivas).
 * Flujos: las compras salen de la orden de cada lote (un lote de escisión no tiene orden: sin flujo) y las ventas,
 * de las órdenes con asignaciones FIFO; así ningún flujo queda sin sus acciones.
 */
import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { unCierrePorDia } from "./cierres";
import type { Resumen } from "./datos";
import { calcularEvolucion, type EntradasEvolucion, type Evolucion } from "./evolucion";

async function leer(db: PrismaClient, ids: readonly string[], referencia: Date) {
  const enIds = { instrumentoId: { in: [...ids] } };
  return db.$transaction([
    db.lote.findMany({
      where: enIds,
      select: { id: true, instrumentoId: true, fechaCompra: true, cantidad: true, costoTotal: true, orden: { select: { totalEstimado: true } } },
    }),
    db.orden.findMany({
      where: { ...enIds, lado: "VENTA", estado: "APROBADO", cantidadCompletada: { gt: 0n }, asignaciones: { some: {} } },
      select: { instrumentoId: true, fechaOperacion: true, totalEstimado: true, asignaciones: { select: { loteId: true, cantidad: true, costoBase: true } } },
    }),
    db.dividendo.findMany({ where: enIds, select: { instrumentoId: true, fechaPago: true, montoNeto: true } }),
    db.precioCierre.findMany({
      where: { ...enIds, reemplazadoEn: null, fecha: { lte: referencia } },
      select: { id: true, instrumentoId: true, fecha: true, traidoEn: true, precio: true },
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function obtenerEvolucion(db: PrismaClient, resumen: Pick<Resumen, "tablero">): Promise<Evolucion> {
  const t = resumen.tablero;
  const especies = [...t.filas, ...t.cerradas].map((f) => ({ id: f.instrumentoId, nemo: f.nemotecnico }));
  const vacia: EntradasEvolucion = { especies, lotes: [], ventas: [], dividendos: [], cierres: [], referencia: t.fechaReferencia };
  if (especies.length === 0 || t.fechaReferencia === null) return calcularEvolucion(vacia);
  const [lotes, ventas, dividendos, cierres] = await leer(db, especies.map((e) => e.id), t.fechaReferencia);
  return calcularEvolucion({
    ...vacia,
    lotes: lotes.map((l) => ({ id: l.id, instrumentoId: l.instrumentoId, fecha: l.fechaCompra, cantidad: l.cantidad, costoTotal: l.costoTotal, flujo: l.orden?.totalEstimado ?? null })),
    ventas: ventas.map((v) => ({ instrumentoId: v.instrumentoId, fecha: v.fechaOperacion, ingreso: v.totalEstimado, asignaciones: v.asignaciones })),
    dividendos: dividendos.map((d) => ({ instrumentoId: d.instrumentoId, fecha: d.fechaPago, monto: d.montoNeto })),
    cierres: unCierrePorDia(cierres),
  });
}
