import "server-only";
/**
 * Qué lee /datos-oficiales (frente datos-oficiales-pantalla, C6a). Solo lectura, con la lectura de C5a
 * (src/datos-oficiales/series/leer.ts), y TODO en UNA transacción REPEATABLE READ de solo lectura (enSoloLectura): el
 * último de cada serie, su historia y la base de la variación del IPC salen de una misma foto de la base (guardar.ts
 * retira e inserta en una transacción; con READ COMMITTED, dos sentencias podrían ver estados distintos).
 * Por serie del catálogo, con el MISMO hoy (el día de Colombia, que pasa la página):
 * - el último vigente que ya empezó y su frescura (estadoSerie): la TRM publicada por adelantado no es la de hoy;
 * - la historia de su ventana (un año; cinco en el IPC, que es mensual), hasta hoy, sin lo que empieza después; la
 *   ventana nunca empieza antes del primer día que acepta la lectura;
 * - en una serie índice (el IPC), la variación CALCULADA contra el índice del mismo mes del año anterior; si ese mes no
 *   está, SIN_BASE (nunca contra otro mes).
 * Una serie cuya lectura falla con un error de la lectura (ErrorLecturaSeries: un valor o una fecha que la base no
 * debería tener) queda ERROR sola y se registra solo su código; si falla la variación, solo la variación. Cualquier
 * otro error (la base, un defecto) se propaga: dentro de la transacción, PostgreSQL la abortaría y las demás series
 * fallarían con otro error. La página lo muestra como SinBase o lo deja a src/app/error.tsx.
 * Después, en la MISMA transacción (frente datos-oficiales-decretos-pantalla, C6b), el lector de C5b (leerDecretos, sin
 * cambios): el cruce con Trii desde hoy − 365 por fecha de pago (la ventana de un año de las gráficas) y los próximos ex.
 * Ese lector abre su foto con enSoloLectura; aquí recibe la transacción ya abierta (enEstaTransaccion), así no abre otra.
 * Luego, en ese mismo tx, la especie de cada fila y la referencia y la versión de cada decreto del cruce, por id y con
 * select explícito (nunca la fila cruda; ninguna consulta si no hay filas). Los decretos no tienen un error de lectura
 * propio: cualquier error se propaga y la página entera sale como SinBase o error.tsx (es la misma transacción).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { enSoloLectura } from "@/conciliacion/leer";
import { CATALOGO, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { leerDecretos, type LecturaDecretos } from "@/datos-oficiales/decretos/leer";
import { ErrorLecturaSeries, SERIES_INDICE, variacionIndice, type CifraOficial } from "@/datos-oficiales/series/consulta";
import { DIA_MINIMO_LECTURA_MS, estadoSerie, serieEnRango, valorVigenteEn, type LectorSeries } from "@/datos-oficiales/series/leer";
import { sumarDias } from "@/plan/fechas";
import { aDatosOficiales, type LecturaSerie, type LecturaVariacion } from "./serializar";
import { aDecretosVista, type LecturaDecretosPantalla } from "./serializar-decretos";
import type { Ventana, VistaDatosOficiales } from "./tipos";

/** Días que mira atrás cada gráfica, contando hoy. */
export const VENTANA_DIAS: Readonly<Record<Ventana, number>> = Object.freeze({ ANIO: 366, CINCO_ANIOS: 5 * 366 });

const ventanaDe = (s: SerieCatalogo): Ventana => (s.vigencia.tipo === "MES" ? "CINCO_ANIOS" : "ANIO");

function inicioDeVentana(ventana: Ventana, hoy: Date): Date {
  const inicio = sumarDias(hoy, -(VENTANA_DIAS[ventana] - 1));
  return inicio.getTime() < DIA_MINIMO_LECTURA_MS ? new Date(DIA_MINIMO_LECTURA_MS) : inicio;
}

/** El primer día del mes de `d`, `anios` años antes. */
const primerDiaDelMes = (d: Date, anios = 0): Date => new Date(Date.UTC(d.getUTCFullYear() - anios, d.getUTCMonth(), 1));

const registrar = (codigo: string, error: ErrorLecturaSeries): void => {
  console.error(`[datos-oficiales] ${codigo}: ${error.codigo}`);
};

async function leerVariacion(tx: LectorSeries, ultimo: CifraOficial): Promise<LecturaVariacion> {
  const mesBase = primerDiaDelMes(ultimo.desde, 1);
  try {
    const base = await valorVigenteEn(tx, ultimo.serie, mesBase);
    if (base === null) return { estado: "SIN_BASE", mesBase };
    return { estado: "CALCULADA", cifra: variacionIndice(base, ultimo), mesBase, mesFinal: primerDiaDelMes(ultimo.desde) };
  } catch (error) {
    if (!(error instanceof ErrorLecturaSeries)) throw error;
    registrar(`${ultimo.serie} (variación)`, error);
    return { estado: "NO_SE_PUDO" };
  }
}

async function leerSerie(tx: LectorSeries, serie: SerieCatalogo, hoy: Date): Promise<LecturaSerie> {
  const ventana = ventanaDe(serie);
  try {
    const { ultimo, frescura } = await estadoSerie(tx, serie.codigo, hoy);
    if (ultimo === null) return { serie, ventana, estado: "SIN_DATOS" };
    const historia = await serieEnRango(tx, serie.codigo, inicioDeVentana(ventana, hoy), hoy);
    const variacion = SERIES_INDICE.includes(serie.codigo) ? await leerVariacion(tx, ultimo) : null;
    return { serie, ventana, estado: "CON_DATOS", ultimo, frescura, historia, variacion };
  } catch (error) {
    if (!(error instanceof ErrorLecturaSeries)) throw error;
    registrar(serie.codigo, error);
    return { serie, ventana, estado: "ERROR" };
  }
}

/** Desde qué fecha de pago se muestra el cruce de los decretos: el último año, como la gráfica de una serie diaria. */
export const desdeDelCruce = (hoy: Date): Date => sumarDias(hoy, -(VENTANA_DIAS.ANIO - 1));

const unicos = (ids: readonly string[]): string[] => [...new Set(ids)];

/**
 * La transacción ya abierta con la forma que pide el lector de C5b: leerDecretos abre su foto con enSoloLectura, que
 * solo llama a `$transaction(leer, opciones)`. Aquí ese `$transaction` corre `leer` con ESTE tx: el cruce y los próximos
 * salen de la misma foto que las series, sin otra transacción ni otra conexión. Las opciones (aislamiento y plazos) no
 * cuentan: son las de esta transacción, que también abrió enSoloLectura. enSoloLectura repite SET TRANSACTION READ ONLY,
 * que PostgreSQL acepta dentro de una transacción de solo lectura ya empezada (sondeo del 2026-11-22 contra la base de
 * pruebas: sigue REPEATABLE READ y rechaza escribir). Si enSoloLectura llamara otra cosa, revienta: lo prueban
 * tests/unit/pantalla-datos-oficiales/datos.test.ts y la integración (una sola transacción).
 */
export function enEstaTransaccion(tx: Prisma.TransactionClient): PrismaClient {
  const soloTransaccion = { $transaction: <T>(leer: (t: Prisma.TransactionClient) => Promise<T>): Promise<T> => leer(tx) };
  return Object.freeze(soloTransaccion) as unknown as PrismaClient;
}

/** Las especies (de las filas del cruce y de los próximos) y las referencias de los decretos del cruce, en el mismo tx. */
async function completarDecretos(tx: Prisma.TransactionClient, desde: Date, lectura: LecturaDecretos): Promise<LecturaDecretosPantalla> {
  const ids = unicos([...lectura.cruce.filas.map((f) => f.instrumentoId), ...lectura.proximos.map((p) => p.instrumentoId)]);
  const decretoIds = unicos(lectura.cruce.filas.flatMap((f) => f.decretos.map((d) => d.decretoId)));
  const especies = ids.length === 0 ? [] : await tx.instrumento.findMany({ where: { id: { in: ids } }, select: { id: true, nemotecnico: true, nombre: true } });
  const referencias = decretoIds.length === 0
    ? []
    : await tx.dividendoDecretado.findMany({ where: { id: { in: decretoIds } }, select: { id: true, referenciaOficial: true, version: true } });
  return {
    desde, lectura,
    especies: new Map(especies.map((e) => [e.id, { nemotecnico: e.nemotecnico, nombre: e.nombre }])),
    referencias: new Map(referencias.map((r) => [r.id, { referenciaOficial: r.referenciaOficial, version: r.version }])),
  };
}

/** Las series del catálogo y los decretos, leídos en una sola transacción de solo lectura, con el día de Colombia `hoy` (medianoche UTC). */
export async function datosOficiales(db: PrismaClient, hoy: Date): Promise<VistaDatosOficiales> {
  const desde = desdeDelCruce(hoy);
  const { lecturas, decretos } = await enSoloLectura(db, async (tx) => {
    const leidas: LecturaSerie[] = [];
    // Una tras otra: una transacción interactiva es una sola conexión.
    for (const serie of CATALOGO) leidas.push(await leerSerie(tx, serie, hoy));
    return { lecturas: leidas, decretos: await completarDecretos(tx, desde, await leerDecretos(enEstaTransaccion(tx), hoy, desde)) };
  });
  return aDatosOficiales(hoy, lecturas, aDecretosVista(decretos));
}
