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
 */
import type { PrismaClient } from "@prisma/client";
import { enSoloLectura } from "@/conciliacion/leer";
import { CATALOGO, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { ErrorLecturaSeries, SERIES_INDICE, variacionIndice, type CifraOficial } from "@/datos-oficiales/series/consulta";
import { DIA_MINIMO_LECTURA_MS, estadoSerie, serieEnRango, valorVigenteEn, type LectorSeries } from "@/datos-oficiales/series/leer";
import { sumarDias } from "@/plan/fechas";
import { aDatosOficiales, type LecturaSerie, type LecturaVariacion } from "./serializar";
import type { Ventana, VistaDatosOficiales } from "./tipos";

/** Días que mira atrás cada gráfica, contando hoy. */
export const VENTANA_DIAS: Readonly<Record<Ventana, number>> = Object.freeze({ ANIO: 366, CINCO_ANIOS: 5 * 366 });

const ventanaDe = (s: SerieCatalogo): Ventana => (s.vigencia.tipo === "MES" ? "CINCO_ANIOS" : "ANIO");

function inicioDeVentana(ventana: Ventana, hoy: Date): Date {
  const inicio = sumarDias(hoy, -(VENTANA_DIAS[ventana] - 1));
  return inicio.getTime() < DIA_MINIMO_LECTURA_MS ? new Date(DIA_MINIMO_LECTURA_MS) : inicio;
}

/** El primer día del mismo mes del año anterior. */
const mesBaseDe = (desde: Date): Date => new Date(Date.UTC(desde.getUTCFullYear() - 1, desde.getUTCMonth(), 1));

const registrar = (codigo: string, error: ErrorLecturaSeries): void => {
  console.error(`[datos-oficiales] ${codigo}: ${error.codigo}`);
};

async function leerVariacion(tx: LectorSeries, ultimo: CifraOficial): Promise<LecturaVariacion> {
  const mesBase = mesBaseDe(ultimo.desde);
  try {
    const base = await valorVigenteEn(tx, ultimo.serie, mesBase);
    if (base === null) return { estado: "SIN_BASE", mesBase };
    return { estado: "CALCULADA", cifra: variacionIndice(base, ultimo), mesBase, mesFinal: new Date(Date.UTC(ultimo.desde.getUTCFullYear(), ultimo.desde.getUTCMonth(), 1)) };
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

/** Las series del catálogo leídas en una sola transacción de solo lectura, con el día de Colombia `hoy` (medianoche UTC). */
export async function datosOficiales(db: PrismaClient, hoy: Date): Promise<VistaDatosOficiales> {
  const lecturas = await enSoloLectura(db, async (tx) => {
    const leidas: LecturaSerie[] = [];
    // Una tras otra: una transacción interactiva es una sola conexión.
    for (const serie of CATALOGO) leidas.push(await leerSerie(tx, serie, hoy));
    return leidas;
  });
  return aDatosOficiales(hoy, lecturas);
}
