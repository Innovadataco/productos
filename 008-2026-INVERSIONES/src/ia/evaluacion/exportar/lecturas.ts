/**
 * Las lecturas del export de hechos (E7), dentro de la foto de solo lectura, con los lectores que ya usan las pantallas
 * (ninguno lee columnas cifradas ni filas crudas: todos van con `select` explícito):
 * - las series oficiales: el último vigente y su frescura (`estadoSerie`), el vigente anterior para la dirección y, del
 *   IPC, la variación anual que calcula 008 (`variacionIndice`, como la pantalla de datos oficiales);
 * - el plan: la versión vigente hoy (`vigenteEn`), sus reglas, sus últimos cierres y los próximos ex-dividendos;
 * - la proyección con los parámetros por omisión de la pantalla, pero con horizonte de 12 meses (el del armador).
 */
import type { PrismaClient } from "@prisma/client";
import { CONTROLES_INICIALES } from "../../../app/proyecciones/opciones";
import { SEMILLA_PANTALLA, TRAYECTORIAS_PANTALLA } from "../../../app/proyecciones/controles";
import { vigenteEn } from "../../../app/plan/vista";
import { leerProximos } from "../../../datos-oficiales/decretos/leer";
import { estadoSerie, valorVigenteEn } from "../../../datos-oficiales/series/leer";
import { ErrorLecturaSeries, variacionIndice } from "../../../datos-oficiales/series/consulta";
import { sumarDias } from "../../../plan/fechas";
import { leerReglas, leerVersiones, ultimosCierres } from "../../../plan/lectura";
import type { CalendarioBvc } from "../../../precios/negociacion";
import { calcularProyeccion } from "../../../proyecciones/calcular";
import { leerEntradas } from "../../../proyecciones/leer";
import { validarParametros } from "../../../proyecciones/parametros";
import { ErrorTrabajo } from "../../../proyecciones/simulacion";
import type { EntradasProyeccion, ResultadoProyeccion } from "../../../proyecciones/tipos";
import type { Resumen } from "../../../tablero/datos";
import type { EntradaArmadoReglas, SerieParaHechos } from "../../hechos";

const SERIES_OFICIALES = Object.freeze(["TRM", "TPM", "IBR_3M_EA"]);
const SERIE_IPC = "IPC_INDICE";
export const HORIZONTE_ESCENARIOS_MESES = 12;

const primerDiaDelMes = (d: Date, anios = 0): Date => new Date(Date.UTC(d.getUTCFullYear() - anios, d.getUTCMonth(), 1));

/** Una serie oficial, o null si no hay dato (o no se pudo leer: se informa con su código). */
async function serieOficial(c: PrismaClient, codigo: string, hoy: Date): Promise<SerieParaHechos | null> {
  const { ultimo, frescura } = await estadoSerie(c, codigo, hoy);
  if (ultimo === null) return null;
  const anterior = await valorVigenteEn(c, codigo, sumarDias(ultimo.desde, -1));
  return { cifra: ultimo, frescura, anterior: anterior?.valor ?? null };
}

/** La variación anual del IPC (el mes del último índice contra el mismo mes del año anterior), con la frescura del índice. */
async function variacionIpc(c: PrismaClient, hoy: Date): Promise<SerieParaHechos | null> {
  const { ultimo, frescura } = await estadoSerie(c, SERIE_IPC, hoy);
  if (ultimo === null) return null;
  const base = await valorVigenteEn(c, SERIE_IPC, primerDiaDelMes(ultimo.desde, 1));
  return base === null ? null : { cifra: variacionIndice(base, ultimo), frescura, anterior: null };
}

export interface SeriesLeidas {
  readonly series: readonly SerieParaHechos[];
  /** Códigos de las series que no se pudieron leer (ErrorLecturaSeries). */
  readonly ilegibles: readonly string[];
}

export async function leerSeries(c: PrismaClient, hoy: Date): Promise<SeriesLeidas> {
  const series: SerieParaHechos[] = [];
  const ilegibles: string[] = [];
  const lectores: readonly (readonly [string, () => Promise<SerieParaHechos | null>])[] = [
    ...SERIES_OFICIALES.map((codigo) => [codigo, () => serieOficial(c, codigo, hoy)] as const),
    [SERIE_IPC, () => variacionIpc(c, hoy)],
  ];
  // Una tras otra: una transacción interactiva es una sola conexión.
  for (const [codigo, leer] of lectores) {
    try {
      const s = await leer();
      if (s !== null) series.push(s);
    } catch (error) {
      if (!(error instanceof ErrorLecturaSeries)) throw error;
      ilegibles.push(codigo);
    }
  }
  return Object.freeze({ series: Object.freeze(series), ilegibles: Object.freeze(ilegibles) });
}

/** La entrada del armador REGLAS desde la versión vigente del plan, o null si hoy no rige ninguna. */
export async function leerEntradaReglas(c: PrismaClient, hoy: Date, hoyIso: string, resumen: Resumen, calendario: CalendarioBvc): Promise<EntradaArmadoReglas | null> {
  const vigente = vigenteEn(await leerVersiones(c), hoy);
  if (vigente === null) return null;
  const reglas = await leerReglas(c, vigente.id);
  const especies = reglas.flatMap((r) => (r.instrumentoId === null ? [] : [r.instrumentoId]));
  return {
    hoy: hoyIso, calendario, vigenteDesde: vigente.vigenteDesde, reglas, cierres: await ultimosCierres(c, especies),
    referencia: resumen.tablero.fechaReferencia, proximos: await leerProximos(c, hoy),
  };
}

export interface ProyeccionLeida {
  readonly entradas: EntradasProyeccion;
  /** null si los parámetros no pasan o el trabajo es demasiado (con su código). */
  readonly resultado: ResultadoProyeccion | null;
  readonly codigo: string | null;
}

/** La proyección como la calcula la pantalla (`proyectar`: validar, leer y calcular), con horizonte de 12 meses. */
export async function leerProyeccion(c: PrismaClient, hoy: Date): Promise<ProyeccionLeida> {
  const v = validarParametros({ ...CONTROLES_INICIALES, horizonteMeses: HORIZONTE_ESCENARIOS_MESES, trayectorias: TRAYECTORIAS_PANTALLA, semilla: SEMILLA_PANTALLA });
  const entradas = await leerEntradas(c, hoy);
  if (!v.ok) return Object.freeze({ entradas, resultado: null, codigo: "PARAMETROS_INVALIDOS" });
  try {
    return Object.freeze({ entradas, resultado: calcularProyeccion(entradas, v.valor), codigo: null });
  } catch (error) {
    if (error instanceof ErrorTrabajo) return Object.freeze({ entradas, resultado: null, codigo: "DEMASIADO_TRABAJO" });
    throw error;
  }
}
