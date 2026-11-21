/** Posición viva por especie (INV-SPEC-12): lo comprado o recibido menos lo vendido, y su costo. */
import { Prisma, type PrismaClient } from "@prisma/client";
import { primerRechazo, ventasSinCuadrar } from "./coherencia";
import type { Asignacion, LoteFifo, VentaFifo } from "./tipos";

export interface Posicion {
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
  readonly cantidad: bigint;
  /** Costo de lo que queda (sin comisiones), según el lote: Trii o el portal de A&V. */
  readonly costoVivo: Prisma.Decimal;
  readonly lotesVivos: number;
}

export interface ResultadoPosiciones {
  readonly posiciones: Posicion[];
  /**
   * Especies que quedan fuera hasta resolverse: con ventas sin asignar (VENTA_SIN_LOTES) o con asignaciones
   * que no cuadran con sus lotes y ventas (la misma regla que aplica la construcción, src/lotes/coherencia.ts).
   * Así una bloqueada inválida ya guardada nunca produce una posición negativa ni un costo vivo negativo.
   */
  readonly especiesIncompletas: readonly string[];
}

interface LoteLeido extends LoteFifo {
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
}

interface VentaLeida extends VentaFifo {
  readonly instrumentoId: string;
}

interface AsignacionLeida extends Asignacion {
  readonly especieLote: string;
  readonly especieVenta: string;
}

/**
 * Lee lotes, ventas y asignaciones de una sola foto (REPEATABLE READ): si una construcción confirma entre las
 * tres lecturas, no se ve un lote sin sus asignaciones ni una asignación sin su lote.
 */
async function leer(db: PrismaClient) {
  const [lotes, ventas, asignaciones] = await db.$transaction([
    db.lote.findMany({ select: { id: true, instrumentoId: true, fechaCompra: true, cantidad: true, costoTotal: true, instrumento: { select: { nemotecnico: true } } } }),
    db.orden.findMany({ where: { lado: "VENTA", estado: "APROBADO", cantidadCompletada: { gt: 0n } }, select: { id: true, instrumentoId: true, fechaOperacion: true, cantidadCompletada: true } }),
    db.asignacionVenta.findMany({ select: { ordenVentaId: true, loteId: true, cantidad: true, costoBase: true, lote: { select: { instrumentoId: true } }, ordenVenta: { select: { instrumentoId: true } } } }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    lotes: lotes.map((l): LoteLeido => ({ id: l.id, instrumentoId: l.instrumentoId, nemotecnico: l.instrumento.nemotecnico, fechaCompra: l.fechaCompra, cantidad: l.cantidad, costoTotal: l.costoTotal })),
    ventas: ventas.map((v): VentaLeida => ({ id: v.id, instrumentoId: v.instrumentoId, fecha: v.fechaOperacion, cantidad: v.cantidadCompletada })),
    asignaciones: asignaciones.map((a): AsignacionLeida => ({
      ventaId: a.ordenVentaId, loteId: a.loteId, cantidad: a.cantidad, costoBase: a.costoBase, especieLote: a.lote.instrumentoId, especieVenta: a.ordenVenta.instrumentoId,
    })),
  };
}

type Leido = Awaited<ReturnType<typeof leer>>;

/** Agrupa por especie; una fila puede caer en dos especies (las de una asignación cruzada). */
function agrupar<T>(filas: readonly T[], especies: (x: T) => readonly string[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of filas) {
    for (const e of new Set(especies(x))) {
      const lista = m.get(e);
      if (lista) lista.push(x);
      else m.set(e, [x]);
    }
  }
  return m;
}

/** Especies cuyas asignaciones no cuadran (regla de coherencia) o con ventas que no quedan asignadas exactas. */
function especiesSinCuadrar(d: Leido): Set<string> {
  const lotes = agrupar(d.lotes, (l) => [l.instrumentoId]);
  const ventas = agrupar(d.ventas, (v) => [v.instrumentoId]);
  const asignaciones = agrupar(d.asignaciones, (a) => [a.especieLote, a.especieVenta]);
  const especies = new Set([...lotes.keys(), ...ventas.keys(), ...asignaciones.keys()]);
  return new Set(
    [...especies].filter((e) => {
      const [l, v, a] = [lotes.get(e) ?? [], ventas.get(e) ?? [], asignaciones.get(e) ?? []];
      return primerRechazo(l, v, a) !== null || ventasSinCuadrar(v, a).length > 0;
    }),
  );
}

interface Acumulado {
  readonly nemotecnico: string | null;
  readonly cantidad: bigint;
  readonly costo: Prisma.Decimal;
  readonly vivos: number;
}

/** Suma por especie lo que queda de cada lote. Un lote agotado no aporta costo (lo que le sobre es redondeo). */
function acumular(d: Leido): Map<string, Acumulado> {
  const vendidoPorLote = new Map<string, { cantidad: bigint; costo: Prisma.Decimal }>();
  for (const a of d.asignaciones) {
    const previo = vendidoPorLote.get(a.loteId) ?? { cantidad: 0n, costo: new Prisma.Decimal(0) };
    vendidoPorLote.set(a.loteId, { cantidad: previo.cantidad + a.cantidad, costo: previo.costo.add(a.costoBase) });
  }
  const porEspecie = new Map<string, Acumulado>();
  for (const l of d.lotes) {
    const vendido = vendidoPorLote.get(l.id) ?? { cantidad: 0n, costo: new Prisma.Decimal(0) };
    const queda = l.cantidad - vendido.cantidad;
    const actual = porEspecie.get(l.instrumentoId) ?? { nemotecnico: l.nemotecnico, cantidad: 0n, costo: new Prisma.Decimal(0), vivos: 0 };
    porEspecie.set(l.instrumentoId, {
      ...actual,
      cantidad: actual.cantidad + queda,
      costo: queda > 0n ? actual.costo.add(l.costoTotal.sub(vendido.costo)) : actual.costo,
      vivos: actual.vivos + (queda > 0n ? 1 : 0),
    });
  }
  return porEspecie;
}

/** Posiciones con cantidad > 0. Las especies incompletas quedan fuera y se informan. */
export async function posiciones(db: PrismaClient): Promise<ResultadoPosiciones> {
  const d = await leer(db);
  const incompletas = especiesSinCuadrar(d);
  const lista = [...acumular(d).entries()]
    .filter(([id, p]) => p.cantidad > 0n && !incompletas.has(id))
    .map(([instrumentoId, p]) => ({ instrumentoId, nemotecnico: p.nemotecnico, cantidad: p.cantidad, costoVivo: p.costo, lotesVivos: p.vivos }))
    .sort((a, b) => (a.nemotecnico ?? "").localeCompare(b.nemotecnico ?? ""));
  return { posiciones: lista, especiesIncompletas: [...incompletas].sort() };
}
