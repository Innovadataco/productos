import "server-only";
/**
 * Lector de los decretos para la pantalla (fase C, C5b; la pantalla es C6b): el cruce con los pagos de Trii (cruce.ts)
 * y los próximos ex-dividendos (proximos.ts). Solo lectura, en una foto (enSoloLectura) y con `select` explícito:
 * nunca la fila de origen cifrada. Los decretos son los que cuentan: vigentes y no anulados (DECRETOS_QUE_CUENTAN de
 * vigentes.ts, el único filtro).
 * - Cruce desde `desde`: se leen los decretos y los pagos de Trii (sin las fracciones de escisión) de limitesDeLectura,
 *   lo justo para que lo que se muestra salga igual que cruzando toda la historia, y la tenencia de las especies con
 *   decretos (movimientosDeEspecies de src/plan/resultados-lote.ts: órdenes aprobadas y lotes de escisión).
 * - coberturaTrii: el día (en Colombia) de la última carga de Trii de órdenes Y de dividendos (CARGADO y sin revertir),
 *   el menor de los dos; null si falta alguna. Es la regla de `cubiertoHasta` de src/plan/resultados-lote.ts, que no se
 *   exporta (ese archivo es de otro frente): si cambia allá, cambia aquí. Es una APROXIMACIÓN: mide cuándo se cargó, no
 *   hasta qué fecha llega el archivo.
 * - ultimoPagoTrii: la fecha de la última fila de dividendos de Trii guardada (cualquier especie, también una fracción de
 *   escisión: es prueba de hasta dónde llega el archivo, no un dividendo): sin una fila posterior a la ventana de un
 *   decreto no hay prueba de que el archivo cargado la cubra, y el cruce no dice NO_RECIBIDO.
 * - leerDecretos da el cruce y los próximos en una sola foto (la pantalla los muestra juntos).
 * - Las consultas van una tras otra: dentro de la transacción Prisma usa una sola conexión.
 * - `hoy` y `desde` son fechas de negocio (medianoche UTC) y `desde` ≤ `hoy`: si no, RangeError sin tocar la base.
 * La salida lleva Decimal, bigint y Date: quien la pase al navegador la serializa.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { enSoloLectura } from "../../conciliacion/leer";
import { esFechaDeNegocio } from "../../plan/fechas";
import { movimientosDeEspecies } from "../../plan/resultados-lote";
import { fechaEnBogota } from "../../precios/horario";
import { cruzar, desdeEn, limitesDeLectura, type DecretoCruce, type PagoTrii, type ResultadoCruce } from "./cruce";
import { proximos, type Proximo } from "./proximos";
import { DECRETOS_QUE_CUENTAN } from "./vigentes";

type Lector = Prisma.TransactionClient;
type Db = PrismaClient | Lector;
const CARGAS_TRII = ["TRII_ORDENES", "TRII_DIVIDENDOS"] as const;

function exigirFecha(nombre: string, valor: unknown): asserts valor is Date {
  if (!esFechaDeNegocio(valor)) throw new RangeError(`${nombre} debe ser una fecha de negocio (medianoche UTC).`);
}

export async function coberturaTrii(db: Db): Promise<Date | null> {
  const cargas = await db.cargaArchivo.groupBy({
    by: ["tipoFuente"],
    where: { estado: "CARGADO", revertidaEn: null, tipoFuente: { in: [...CARGAS_TRII] } },
    _max: { cargadoEn: true },
  });
  const fechas = CARGAS_TRII.map((t) => cargas.find((c) => c.tipoFuente === t)?._max.cargadoEn ?? null);
  if (fechas.some((f) => f === null)) return null;
  return fechaEnBogota(new Date(Math.min(...fechas.map((f) => f!.getTime()))));
}

async function leerDecretosDelCruce(tx: Lector, desde: Date): Promise<DecretoCruce[]> {
  return tx.dividendoDecretado.findMany({
    where: { fechaPago: { gte: desde }, ...DECRETOS_QUE_CUENTAN },
    select: { id: true, instrumentoId: true, tipo: true, cuota: true, valorPorAccion: true, fechaEx: true, fechaPago: true },
    orderBy: [{ fechaPago: "asc" }, { id: "asc" }],
  });
}

async function leerPagos(tx: Lector, desde: Date, hoy: Date): Promise<PagoTrii[]> {
  return tx.dividendo.findMany({
    where: { tipo: { not: "FRACCION_ESCISION" }, fechaPago: { gte: desde, lte: hoy } },
    select: { id: true, instrumentoId: true, fechaPago: true, montoNeto: true, tipo: true },
    orderBy: [{ fechaPago: "asc" }, { id: "asc" }],
  });
}

const especiesDe = (filas: readonly { readonly instrumentoId: string }[]): string[] => [...new Set(filas.map((f) => f.instrumentoId))];

async function ultimoPagoTrii(tx: Lector, hoy: Date): Promise<Date | null> {
  const r = await tx.dividendo.aggregate({ where: { fechaPago: { lte: hoy } }, _max: { fechaPago: true } });
  return r._max.fechaPago;
}

async function cruceEnFoto(tx: Lector, hoy: Date, desde: Date): Promise<ResultadoCruce> {
  const limites = limitesDeLectura(desde);
  const decretos = await leerDecretosDelCruce(tx, limites.decretosDesde);
  const pagos = await leerPagos(tx, limites.pagosDesde, hoy);
  const cubiertoHasta = await coberturaTrii(tx);
  const ultimo = await ultimoPagoTrii(tx, hoy);
  const movimientos = await movimientosDeEspecies(tx, especiesDe(decretos), hoy);
  return desdeEn(cruzar({ decretos, pagos, movimientos, cubiertoHasta, ultimoPagoTrii: ultimo, hoy }), desde);
}

async function proximosEnFoto(tx: Lector, hoy: Date): Promise<Proximo[]> {
  const filas = await tx.dividendoDecretado.findMany({
    where: { fechaEx: { gte: hoy }, ...DECRETOS_QUE_CUENTAN },
    select: {
      id: true, instrumentoId: true, tipo: true, cuota: true, valorPorAccion: true, fechaAnuncio: true, fechaEx: true, fechaPago: true,
      referenciaOficial: true, version: true, anulada: true, reemplazadoEn: true, instrumento: { select: { nemotecnico: true } },
    },
    orderBy: [{ fechaEx: "asc" }, { id: "asc" }],
  });
  const movimientos = await movimientosDeEspecies(tx, especiesDe(filas), hoy);
  const vigentes = filas.map(({ instrumento, reemplazadoEn, ...f }) => ({ ...f, nemotecnico: instrumento.nemotecnico, vigente: reemplazadoEn === null }));
  return proximos(vigentes, movimientos, hoy);
}

function exigirRango(hoy: unknown, desde: unknown): asserts hoy is Date {
  exigirFecha("hoy", hoy);
  exigirFecha("desde", desde);
  if (desde > hoy) throw new RangeError("desde no puede ser posterior a hoy.");
}

/** El cruce de lo que tiene fecha de pago desde `desde` (los grupos con ex ya pasada y los pagos sueltos). */
export async function leerCruce(db: PrismaClient, hoy: Date, desde: Date): Promise<ResultadoCruce> {
  exigirRango(hoy, desde);
  return enSoloLectura(db, (tx) => cruceEnFoto(tx, hoy, desde));
}

/** Los decretos vigentes y no anulados con ex ≥ hoy, con la tenencia y el bruto estimado. */
export async function leerProximos(db: PrismaClient, hoy: Date): Promise<readonly Proximo[]> {
  exigirFecha("hoy", hoy);
  return enSoloLectura(db, (tx) => proximosEnFoto(tx, hoy));
}

export interface LecturaDecretos {
  readonly cruce: ResultadoCruce;
  readonly proximos: readonly Proximo[];
}

/** El cruce y los próximos en una sola foto: una carga que confirme entre medio no los desacuerda. */
export async function leerDecretos(db: PrismaClient, hoy: Date, desde: Date): Promise<LecturaDecretos> {
  exigirRango(hoy, desde);
  return enSoloLectura(db, async (tx) => ({ cruce: await cruceEnFoto(tx, hoy, desde), proximos: await proximosEnFoto(tx, hoy) }));
}
