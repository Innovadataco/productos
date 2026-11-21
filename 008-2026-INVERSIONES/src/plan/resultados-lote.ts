/**
 * Resultado a 30 y 90 días de varias decisiones a la vez (fase B, corte 3), sin una consulta por decisión: las
 * decisiones con sus enlaces vigentes y, de todas sus especies juntas, los cierres VIGENTES de Yahoo (la fuente de
 * los diarios), los dividendos, los movimientos de la tenencia (órdenes aprobadas y lotes de escisión), las
 * escisiones y la cobertura de las cargas de Trii. Después, el cálculo puro de `resultado.ts` por decisión.
 * Solo lee, con `select` explícito (nunca el crudo). Quien quiera una sola instantánea lo llama dentro de
 * `enSoloLectura` (las pantallas lo hacen).
 */
import type { LadoOrden } from "@prisma/client";
import { FUENTE as FUENTE_CIERRES } from "../precios/actualizar";
import { fechaEnBogota } from "../precios/horario";
import type { Db } from "./acceso";
import type { ContextoEspecie, DividendoPagado } from "./dividendos";
import { sumarDias } from "./fechas";
import { HORIZONTES, MAX_RETROCESO_DIAS, calcularResultados, type Cierre, type OrdenMedida, type ResultadoHorizonte } from "./resultado";
import type { MovimientoTenencia } from "./tenencia";

export interface ResultadoDecision {
  readonly decisionId: string;
  readonly d30: ResultadoHorizonte;
  readonly d90: ResultadoHorizonte;
}

interface DecisionLeida {
  readonly id: string;
  readonly accion: "COMPRAR" | "VENDER" | "NO_ACTUAR";
  readonly fechaDecision: Date;
  readonly cantidad: bigint | null;
  readonly instrumentoId: string;
  readonly ordenes: readonly OrdenMedida[];
}

const HORIZONTE_MAX = Math.max(...HORIZONTES);
const SIGNO_LADO: Readonly<Record<LadoOrden, bigint>> = { COMPRA: 1n, VENTA: -1n };

function agrupar<T extends { readonly instrumentoId: string }, R>(filas: readonly T[], aValor: (f: T) => R): Map<string, R[]> {
  const m = new Map<string, R[]>();
  for (const f of filas) m.set(f.instrumentoId, [...(m.get(f.instrumentoId) ?? []), aValor(f)]);
  return m;
}

async function leerDecisiones(db: Db, ids: readonly string[]): Promise<DecisionLeida[]> {
  const filas = await db.decision.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true, accion: true, fechaDecision: true, cantidad: true, instrumentoId: true,
      enlaces: { where: { reemplazadoPor: { is: null } }, select: { orden: { select: { id: true, fechaOperacion: true, cantidadCompletada: true, totalEstimado: true } } } },
    },
  });
  return filas.map((f) => ({ id: f.id, accion: f.accion, fechaDecision: f.fechaDecision, cantidad: f.cantidad, instrumentoId: f.instrumentoId, ordenes: f.enlaces.map((e) => e.orden) }));
}

/** Movimientos de la tenencia por especie hasta `hasta`: órdenes aprobadas por su operación y lotes de escisión por su fecha. */
export async function movimientosDeEspecies(db: Db, especies: readonly string[], hasta: Date): Promise<Map<string, MovimientoTenencia[]>> {
  const [ordenes, lotes] = await Promise.all([
    db.orden.findMany({
      where: { instrumentoId: { in: [...especies] }, estado: "APROBADO", cantidadCompletada: { gt: 0n }, fechaOperacion: { lte: hasta } },
      select: { instrumentoId: true, lado: true, cantidadCompletada: true, fechaOperacion: true },
    }),
    db.lote.findMany({ where: { instrumentoId: { in: [...especies] }, origen: "ESCISION", fechaCompra: { lte: hasta } }, select: { instrumentoId: true, cantidad: true, fechaCompra: true } }),
  ]);
  const filas = [
    ...ordenes.map((o) => ({ instrumentoId: o.instrumentoId, fecha: o.fechaOperacion, cantidad: SIGNO_LADO[o.lado] * o.cantidadCompletada })),
    ...lotes.map((l) => ({ instrumentoId: l.instrumentoId, fecha: l.fechaCompra, cantidad: l.cantidad })),
  ];
  return agrupar(filas, (f): MovimientoTenencia => ({ fecha: f.fecha, cantidad: f.cantidad }));
}

/** Hasta qué día llegan las cargas de Trii: el menor entre la última de órdenes y la última de dividendos (en Colombia). */
async function cubiertoHasta(db: Db): Promise<Date | null> {
  const cargas = await db.cargaArchivo.groupBy({
    by: ["tipoFuente"],
    where: { estado: "CARGADO", revertidaEn: null, tipoFuente: { in: ["TRII_ORDENES", "TRII_DIVIDENDOS"] } },
    _max: { cargadoEn: true },
  });
  const fechas = (["TRII_ORDENES", "TRII_DIVIDENDOS"] as const).map((t) => cargas.find((c) => c.tipoFuente === t)?._max.cargadoEn ?? null);
  if (fechas.some((f) => f === null)) return null;
  return fechaEnBogota(new Date(Math.min(...fechas.map((f) => f!.getTime()))));
}

interface Rango {
  readonly desde: Date;
  readonly hasta: Date;
}

async function contextos(db: Db, especies: readonly string[], r: Rango): Promise<{ cierres: Map<string, Cierre[]>; contexto: (id: string) => ContextoEspecie }> {
  const [cierres, dividendos, movimientos, eventos, cobertura] = await Promise.all([
    db.precioCierre.findMany({
      where: { instrumentoId: { in: [...especies] }, fuente: FUENTE_CIERRES, reemplazadoEn: null, fecha: { gte: r.desde, lte: r.hasta } },
      select: { id: true, instrumentoId: true, fecha: true, precio: true, estado: true, fuente: true },
      orderBy: { fecha: "asc" },
    }),
    db.dividendo.findMany({ where: { instrumentoId: { in: [...especies] }, fechaPago: { gt: r.desde, lte: r.hasta } }, select: { id: true, instrumentoId: true, fechaPago: true, montoNeto: true, tipo: true } }),
    movimientosDeEspecies(db, especies, r.hasta),
    db.eventoCorporativo.findMany({
      where: { fecha: { lte: r.hasta }, OR: [{ origenId: { in: [...especies] } }, { destinoId: { in: [...especies] } }] },
      select: { origenId: true, destinoId: true, fecha: true, _count: { select: { lotes: true } } },
    }),
    cubiertoHasta(db),
  ]);
  const porEspecie = {
    cierres: agrupar(cierres, ({ instrumentoId: _, ...c }): Cierre => c),
    dividendos: agrupar(dividendos, ({ instrumentoId: _, ...dv }): DividendoPagado => dv),
  };
  const contexto = (id: string): ContextoEspecie => ({
    dividendos: porEspecie.dividendos.get(id) ?? [],
    movimientos: movimientos.get(id) ?? [],
    cubiertoHasta: cobertura,
    destinoSinLote: eventos.some((e) => e.destinoId === id && e._count.lotes === 0),
    escisiones: eventos.filter((e) => e.origenId === id).map((e) => e.fecha),
  });
  return { cierres: porEspecie.cierres, contexto };
}

/** Resultados por id de decisión (los ids que no existen no aparecen). `hoy`: fecha de negocio en Colombia. */
export async function resultadosDeDecisiones(db: Db, ids: readonly string[], hoy: Date): Promise<ReadonlyMap<string, ResultadoDecision>> {
  if (ids.length === 0) return new Map();
  const decisiones = await leerDecisiones(db, ids);
  if (decisiones.length === 0) return new Map();
  const bases = decisiones.flatMap((d) => [d.fechaDecision, ...d.ordenes.map((o) => o.fechaOperacion)]).map((f) => f.getTime());
  const rango = { desde: sumarDias(new Date(Math.min(...bases)), -MAX_RETROCESO_DIAS), hasta: sumarDias(new Date(Math.max(...bases)), HORIZONTE_MAX) };
  const especies = [...new Set(decisiones.map((d) => d.instrumentoId))];
  const { cierres, contexto } = await contextos(db, especies, rango);
  return new Map(
    decisiones.map((d) => {
      const r = calcularResultados({ accion: d.accion, fechaDecision: d.fechaDecision, cantidad: d.cantidad, ordenes: d.ordenes, cierres: cierres.get(d.instrumentoId) ?? [], especie: contexto(d.instrumentoId), hoy });
      return [d.id, { decisionId: d.id, ...r }];
    }),
  );
}
