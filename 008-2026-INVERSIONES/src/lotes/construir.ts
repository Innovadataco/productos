/**
 * Construye los lotes y las asignaciones de venta desde las órdenes importadas (INV-SPEC-12).
 * Idempotente: se puede correr después de cada importación.
 * - Un lote por orden de COMPRA aprobada con acciones completadas (costo de Trii, sin comisión).
 * - Las asignaciones de venta NO bloqueadas se recalculan con FIFO por especie (una compra
 *   importada después con fecha anterior cambia la asignación; las bloqueadas se respetan).
 * - Cada especie se resuelve sola; ninguna bloqueada inválida aborta a las demás:
 *   · bloqueada inválida (BLOQUEADA_* de src/lotes/coherencia.ts): la especie se rechaza y NO se toca;
 *   · BLOQUEADA_INCOMPLETA o COSTO_NEGATIVO (bloqueadas válidas que el FIFO no puede completar): se borran
 *     sus asignaciones FIFO y se conservan las bloqueadas, así sus ventas quedan sin asignar y posiciones
 *     la deja fuera;
 *   · VENTA_SIN_LOTES (ventas que no caben en sus lotes): igual, como siempre; nunca una posición negativa.
 *   Los lotes de compra se crean para todas las especies: «no se toca» se refiere a sus asignaciones.
 * - Ensayo: la misma transacción, que se deshace al final (informa lo mismo y no guarda nada).
 * Un error inesperado de la base sí aborta todo (nada a medias).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { asignarFifo } from "./fifo";
import type { CodigoBloqueada, CodigoRechazo } from "./tipos";

type Tx = Prisma.TransactionClient;

export interface EspecieRechazada {
  readonly instrumentoId: string;
  readonly codigo: CodigoRechazo;
  readonly ventaId: string | null;
  readonly loteId: string | null;
}

export interface ResultadoConstruccion {
  readonly ensayo: boolean;
  readonly lotesCreados: number;
  readonly especiesConVentas: number;
  readonly asignacionesRecalculadas: number;
  /** Ids de instrumento cuyas ventas no caben en sus lotes (falta un lote, p. ej. de escisión). */
  readonly especiesSinLotes: readonly string[];
  /** Especies rechazadas por sus asignaciones bloqueadas, con el código y la fila que lo causa. */
  readonly especiesRechazadas: readonly EspecieRechazada[];
}

export interface OpcionesConstruccion {
  readonly ensayo?: boolean;
}

type ResultadoEspecie =
  | { readonly tipo: "ok"; readonly asignadas: number }
  | { readonly tipo: "sinLotes" }
  | { readonly tipo: "rechazada"; readonly rechazo: EspecieRechazada };

const VENTA_CON_ACCIONES = { lado: "VENTA", estado: "APROBADO", cantidadCompletada: { gt: 0n } } as const;
/** Códigos que se detectan antes del FIFO: la bloqueada misma es inválida y la especie no se toca. */
const NO_SE_TOCA: ReadonlySet<string> = new Set<CodigoBloqueada>([
  "BLOQUEADA_VENTA_AJENA", "BLOQUEADA_LOTE_AJENO", "BLOQUEADA_LOTE_POSTERIOR", "BLOQUEADA_EXCEDE_VENTA",
  "BLOQUEADA_EXCEDE_LOTE", "BLOQUEADA_EXCEDE_COSTO", "BLOQUEADA_COSTO_DESCUADRADO",
]);
const noSeToca = (codigo: string): codigo is CodigoBloqueada => NO_SE_TOCA.has(codigo);

async function crearLotesDeCompras(tx: Tx): Promise<number> {
  const compras = await tx.orden.findMany({
    where: { lado: "COMPRA", estado: "APROBADO", cantidadCompletada: { gt: 0n }, lote: null },
    orderBy: { id: "asc" },
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

/** Especies a resolver: las que tienen ventas y las que tocan una bloqueada (por su lote o por su orden). */
async function especiesAResolver(tx: Tx): Promise<{ especies: string[]; conVentas: number }> {
  const [conVentas, bloqueadas] = await Promise.all([
    tx.orden.findMany({ where: VENTA_CON_ACCIONES, distinct: ["instrumentoId"], select: { instrumentoId: true } }),
    tx.asignacionVenta.findMany({ where: { bloqueada: true }, select: { lote: { select: { instrumentoId: true } }, ordenVenta: { select: { instrumentoId: true } } } }),
  ]);
  const todas = [...conVentas.map((o) => o.instrumentoId), ...bloqueadas.flatMap((b) => [b.lote.instrumentoId, b.ordenVenta.instrumentoId])];
  return { especies: [...new Set(todas)].sort(), conVentas: conVentas.length };
}

async function datosDeEspecie(tx: Tx, instrumentoId: string) {
  const [lotes, ventas, bloqueadas] = await Promise.all([
    tx.lote.findMany({ where: { instrumentoId }, select: { id: true, fechaCompra: true, cantidad: true, costoTotal: true } }),
    tx.orden.findMany({ where: { instrumentoId, ...VENTA_CON_ACCIONES }, select: { id: true, fechaOperacion: true, cantidadCompletada: true } }),
    tx.asignacionVenta.findMany({ where: { bloqueada: true, OR: [{ lote: { instrumentoId } }, { ordenVenta: { instrumentoId } }] } }),
  ]);
  return {
    lotes,
    ventas: ventas.map((v) => ({ id: v.id, fecha: v.fechaOperacion, cantidad: v.cantidadCompletada })),
    bloqueadas: bloqueadas.map((b) => ({ ventaId: b.ordenVentaId, loteId: b.loteId, cantidad: b.cantidad, costoBase: b.costoBase })),
  };
}

/** Borra las asignaciones FIFO (no bloqueadas) de la especie, por su lote o por su venta. */
const borrarFifo = (tx: Tx, instrumentoId: string) =>
  tx.asignacionVenta.deleteMany({ where: { bloqueada: false, OR: [{ lote: { instrumentoId } }, { ordenVenta: { instrumentoId } }] } });

async function reasignarVentas(tx: Tx, instrumentoId: string): Promise<ResultadoEspecie> {
  const d = await datosDeEspecie(tx, instrumentoId);
  const r = asignarFifo(d.lotes, d.ventas, d.bloqueadas);
  if (!r.ok && r.codigo !== "VENTA_SIN_LOTES" && noSeToca(r.codigo)) {
    return { tipo: "rechazada", rechazo: { instrumentoId, codigo: r.codigo, ventaId: r.ventaId, loteId: r.loteId } };
  }
  await borrarFifo(tx, instrumentoId);
  if (!r.ok) {
    return r.codigo === "VENTA_SIN_LOTES"
      ? { tipo: "sinLotes" }
      : { tipo: "rechazada", rechazo: { instrumentoId, codigo: r.codigo, ventaId: r.ventaId, loteId: r.loteId } };
  }
  await tx.asignacionVenta.createMany({
    data: r.asignaciones.map((a) => ({ ordenVentaId: a.ventaId, loteId: a.loteId, cantidad: a.cantidad, costoBase: a.costoBase, metodo: "FIFO" as const })),
  });
  return { tipo: "ok", asignadas: r.asignaciones.length };
}

async function construirEnTransaccion(tx: Tx, ensayo: boolean): Promise<ResultadoConstruccion> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inv008-construir-lotes'))`;
  const lotesCreados = await crearLotesDeCompras(tx);
  const { especies, conVentas } = await especiesAResolver(tx);
  let asignacionesRecalculadas = 0;
  const especiesSinLotes: string[] = [];
  const especiesRechazadas: EspecieRechazada[] = [];
  for (const instrumentoId of especies) {
    const r = await reasignarVentas(tx, instrumentoId);
    if (r.tipo === "ok") asignacionesRecalculadas += r.asignadas;
    else if (r.tipo === "sinLotes") especiesSinLotes.push(instrumentoId);
    else especiesRechazadas.push(r.rechazo);
  }
  return { ensayo, lotesCreados, especiesConVentas: conVentas, asignacionesRecalculadas, especiesSinLotes, especiesRechazadas };
}

/** Señal para deshacer la transacción del ensayo y devolver su resultado. */
class DeshacerEnsayo extends Error {
  constructor(readonly resultado: ResultadoConstruccion) {
    super("ensayo: se deshace");
    this.name = "DeshacerEnsayo";
  }
}

export async function construirLotes(db: PrismaClient, opciones: OpcionesConstruccion = {}): Promise<ResultadoConstruccion> {
  const ensayo = opciones.ensayo === true;
  try {
    return await db.$transaction(
      async (tx) => {
        const r = await construirEnTransaccion(tx, ensayo);
        if (ensayo) throw new DeshacerEnsayo(r);
        return r;
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    if (e instanceof DeshacerEnsayo) return e.resultado;
    throw e;
  }
}
