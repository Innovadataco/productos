/**
 * Camino ÚNICO de escritura de valor_serie_oficial (fase C, C2a): hoy lo usa `importar-series` (el CSV de la vía B,
 * importar.ts); los demás caminos de la fase C entran por aquí. Candado: tests/unit/datos-oficiales/camino-unico-series.test.ts
 * (solo este archivo hace valorSerieOficial.createMany y valorSerieOficial.updateMany).
 * - Lo que publica la fuente, sin convertir: una vigencia por fila. Qué es nuevo, qué revisa y qué queda igual lo decide
 *   `planificar` (puro) sobre lo que se acaba de leer; reimportar el mismo CSV no escribe nada.
 * - Por lotes de TAMANO_LOTE_SERIES filas, en orden de desde, cada uno en una transacción: una lectura de los vigentes
 *   de la ventana (usa el índice único parcial (serie, desde): la vigencia dura a lo sumo 32 días), el retiro con guarda
 *   (`reemplazadoEn` nulo; la hora la pone inv_solo_retiro) de los que se solapan con una fila distinta y una inserción.
 *   Si lo que se retira pasa del corte, el lote se alarga (finDeLote) para que el retiro y todo su reemplazo vayan en
 *   la misma transacción; si en MAX_VUELTAS_LOTE vueltas no encuentra corte, ese lote no se escribe (LoteSinCorte).
 * - Dos corridas de la misma serie se ponen en fila con un candado de asesoría por serie (database-reviewer, MEDIO).
 * - Choques con otra escritura: el retiro que cuenta menos (otra ya retiró), P2002 (el índice único parcial), la
 *   exclusión de vigencias (SQLSTATE 23P01: Prisma 5.22 la entrega como PrismaClientUnknownRequestError, sin código;
 *   verificado en tests/integracion/series-importar.test.ts) y P2034 (conflicto de escritura o bloqueo mutuo). Cuál de
 *   los dos primeros salta cuando chocan los dos depende del orden de los índices, que cambia al restaurar un respaldo:
 *   se manejan los dos. Se deshace el lote y se reintenta releyendo, hasta MAX_INTENTOS_SERIES.
 * - Un lote que falla detiene SU serie (los siguientes podrían retirar un vigente cuyo reemplazo estaba en el lote
 *   fallido); las demás series siguen. Volver a correr el mismo CSV completa sin duplicar.
 * - Los fallos salen con código, nombre y código del error, nunca su mensaje (el del 23P01 trae la clave y las fechas).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { CODIGO_SERIALIZACION, CODIGO_UNICIDAD, esExclusion, tieneCodigo } from "../../lib/choques";
import { detalleDeError } from "../../precios/guardar";
import type { ValorSerie } from "./csv-series";
import { finDeLote, planificar, type PlanSerie, type VigenteSerie } from "./planificar";

export const TAMANO_LOTE_SERIES = 500;
export const MAX_INTENTOS_SERIES = 3;
/** Vueltas para alargar un lote. Con datos reales basta una (una TRM revisada que pasa del corte); más es un caso raro. */
export const MAX_VUELTAS_LOTE = 8;
/**
 * Plazo de la transacción de un lote. Copiado del camino del fondo (src/fondo/guardar.ts), no medido para las series:
 * POR VERIFICAR en el VPS. Si se vence, el lote se deshace entero y la serie sale con GUARDADO_ERROR.
 */
export const TIEMPO_MAXIMO_LOTE_SERIES_MS = 30_000;
/** Cuánto espera un lote una conexión libre para abrir su transacción. */
export const ESPERA_MAXIMA_TX_SERIES_MS = 10_000;
/** La base exige hasta ≤ desde + 31 (valor_serie_oficial_vigencia_chk): un vigente que toca la ventana empieza a lo sumo 31 días antes. */
const MAX_DIAS_TRAS_DESDE = 31;
const DIA_MS = 86_400_000;

export interface SerieAGuardar {
  readonly codigo: string;
  readonly fuente: string;
  /** Sin solapes entre sí (lo garantiza el CSV); en cualquier orden. */
  readonly valores: readonly ValorSerie[];
}

export interface FalloSerie {
  readonly codigo: "GUARDADO_ERROR" | "BASE_ERROR";
  /** Solo nombre y código del error (p. ej. «PrismaClientKnownRequestError P2028»); nunca el mensaje. */
  readonly detalle?: string;
  /** Filas que quedaron sin guardar (el lote que falló y los que le seguían). */
  readonly sinGuardar: number;
}

export interface BalanceSerie {
  readonly codigo: string;
  readonly filas: number;
  readonly nuevas: number;
  readonly revisadas: number;
  readonly retiradas: number;
  readonly sinCambios: number;
  /** Días de vigentes retirados que ninguna fila nueva cubre (la fuente acortó una vigencia). */
  readonly diasDescubiertos: number;
  /** El hasta del último vigente de la serie después de guardar (null si no tiene o si no se pudo leer). */
  readonly ultimoHasta: Date | null;
  readonly fallo: FalloSerie | null;
}

/** Otra corrida retiró un vigente entre la lectura y el retiro: hay que releer. */
class ConflictoConcurrente extends Error {
  constructor() {
    super("conflicto");
    this.name = "ConflictoConcurrente";
  }
}

/** Alargar el lote no encontró dónde cortar en MAX_VUELTAS_LOTE vueltas. */
class LoteSinCorte extends Error {
  constructor() {
    super("lote sin corte");
    this.name = "LoteSinCorte";
  }
}

/** ¿Chocó con otra escritura? P2002 o P2034 por su código, o la exclusión 23P01 (src/lib/choques.ts); el mensaje nunca se muestra. */
const esChoque = (e: unknown): boolean =>
  e instanceof ConflictoConcurrente || tieneCodigo(e, CODIGO_UNICIDAD, CODIGO_SERIALIZACION) || esExclusion(e);

type Transaccion = Prisma.TransactionClient;

/** Los vigentes de la serie que pueden solaparse con las filas del lote (ordenadas por desde, sin solapes entre sí). */
async function leerVigentes(tx: Transaccion, serie: string, lote: readonly ValorSerie[]): Promise<VigenteSerie[]> {
  const primero = lote[0]!.desde.getTime();
  const vigentes = await tx.valorSerieOficial.findMany({
    where: { serie, reemplazadoEn: null, desde: { gte: new Date(primero - MAX_DIAS_TRAS_DESDE * DIA_MS), lte: lote.at(-1)!.hasta }, hasta: { gte: lote[0]!.desde } },
    select: { id: true, desde: true, hasta: true, valor: true },
    orderBy: { desde: "asc" },
  });
  return vigentes.map((v) => ({ id: v.id, desde: v.desde, hasta: v.hasta, valor: v.valor.toFixed() }));
}

/** El retiro con guarda (si otra corrida ya retiró alguno, se relee) y la inserción de lo que entra. */
async function escribir(tx: Transaccion, serie: SerieAGuardar, plan: PlanSerie): Promise<void> {
  if (plan.aRetirar.length > 0) {
    const { count } = await tx.valorSerieOficial.updateMany({ where: { id: { in: [...plan.aRetirar] }, reemplazadoEn: null }, data: { reemplazadoEn: new Date() } });
    if (count !== plan.aRetirar.length) throw new ConflictoConcurrente();
  }
  const entran = [...plan.nuevas, ...plan.revisadas].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  if (entran.length === 0) return;
  await tx.valorSerieOficial.createMany({
    data: entran.map((v) => ({ serie: serie.codigo, desde: v.desde, hasta: v.hasta, valor: new Prisma.Decimal(v.valor), fuente: serie.fuente })),
  });
}

interface Lote {
  /** Dónde empieza el lote siguiente (exclusivo). */
  readonly fin: number;
  readonly plan: PlanSerie;
}

/** La clave del candado de asesoría de una serie (pg_advisory_xact_lock(hashtext(clave))). */
export const candadoSerie = (codigo: string): string => `008:serie-oficial:${codigo}`;

/**
 * Un lote en una transacción, alargado si hace falta: el candado de la serie, leer, planificar, retirar e insertar. Todo
 * o nada. El candado (de transacción: se suelta al confirmar o deshacer) pone en fila a dos corridas de la misma serie:
 * la segunda lee lo que la primera ya confirmó, sin chocar ni agotar los reintentos. Quien escriba sin pasar por aquí
 * sigue chocando con la base (P2002 o 23P01) y se reintenta.
 */
async function guardarLote(db: PrismaClient, serie: SerieAGuardar, filas: readonly ValorSerie[], inicio: number): Promise<Lote> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${candadoSerie(serie.codigo)}))`;
    let fin = Math.min(inicio + TAMANO_LOTE_SERIES, filas.length);
    let lote = filas.slice(inicio, fin);
    let plan = planificar(lote, await leerVigentes(tx, serie.codigo, lote));
    for (let vuelta = 0; ; vuelta += 1) {
      const alargado = finDeLote(filas, fin, plan.extremoRetirado);
      if (alargado === fin) break;
      if (vuelta >= MAX_VUELTAS_LOTE) throw new LoteSinCorte();
      fin = alargado;
      lote = filas.slice(inicio, fin);
      plan = planificar(lote, await leerVigentes(tx, serie.codigo, lote));
    }
    await escribir(tx, serie, plan);
    return { fin, plan };
  }, { timeout: TIEMPO_MAXIMO_LOTE_SERIES_MS, maxWait: ESPERA_MAXIMA_TX_SERIES_MS });
}

async function guardarLoteConReintento(db: PrismaClient, serie: SerieAGuardar, filas: readonly ValorSerie[], inicio: number): Promise<Lote> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await guardarLote(db, serie, filas, inicio);
    } catch (e) {
      if (!esChoque(e) || intento >= MAX_INTENTOS_SERIES) throw e;
    }
  }
}

interface Conteos {
  readonly nuevas: number;
  readonly revisadas: number;
  readonly retiradas: number;
  readonly sinCambios: number;
  readonly diasDescubiertos: number;
}

const CERO: Conteos = { nuevas: 0, revisadas: 0, retiradas: 0, sinCambios: 0, diasDescubiertos: 0 };

const sumar = (c: Conteos, p: PlanSerie): Conteos => ({
  nuevas: c.nuevas + p.nuevas.length,
  revisadas: c.revisadas + p.revisadas.length,
  retiradas: c.retiradas + p.aRetirar.length,
  sinCambios: c.sinCambios + p.sinCambios,
  diasDescubiertos: c.diasDescubiertos + p.diasDescubiertos,
});

/** El hasta del último vigente: sin solapes, el último desde es también el último hasta (usa el índice único parcial). */
async function ultimoHasta(db: PrismaClient, serie: string): Promise<Date | null> {
  const ultimo = await db.valorSerieOficial.findFirst({ where: { serie, reemplazadoEn: null }, orderBy: { desde: "desc" }, select: { hasta: true } });
  return ultimo?.hasta ?? null;
}

/** Guarda una serie por lotes. Nunca lanza: todo fallo vuelve en el balance. */
async function guardarSerie(db: PrismaClient, serie: SerieAGuardar): Promise<BalanceSerie> {
  const filas = [...serie.valores].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  let conteos = CERO;
  let fallo: FalloSerie | null = null;
  for (let inicio = 0; inicio < filas.length && fallo === null; ) {
    try {
      const lote = await guardarLoteConReintento(db, serie, filas, inicio);
      conteos = sumar(conteos, lote.plan);
      inicio = lote.fin;
    } catch (e) {
      fallo = { codigo: "GUARDADO_ERROR", detalle: detalleDeError(e), sinGuardar: filas.length - inicio };
    }
  }
  let ultimo: Date | null = null;
  try {
    ultimo = await ultimoHasta(db, serie.codigo);
  } catch (e) {
    fallo ??= { codigo: "BASE_ERROR", detalle: detalleDeError(e), sinGuardar: 0 };
  }
  return { codigo: serie.codigo, filas: filas.length, ...conteos, ultimoHasta: ultimo, fallo };
}

/** Guarda las series en serie (una que falla no detiene las demás), en el orden dado. */
export async function guardarSeries(db: PrismaClient, series: readonly SerieAGuardar[]): Promise<BalanceSerie[]> {
  const balances: BalanceSerie[] = [];
  for (const s of series) balances.push(await guardarSerie(db, s));
  return balances;
}
