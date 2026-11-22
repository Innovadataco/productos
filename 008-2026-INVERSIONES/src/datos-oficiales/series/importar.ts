/**
 * `importar-series` (fase C, C2a): guarda el CSV de series oficiales, ya leído y validado (csv-series.ts: todo o nada),
 * por el camino único (guardar.ts), serie por serie y con la fuente del catálogo. «Todo o nada» es la VALIDACIÓN del
 * CSV; la escritura es por serie y por lote: si el proceso muere a mitad, queda lo guardado hasta ahí, y volver a correr
 * el mismo CSV completa sin duplicar.
 *
 * Aquí también va lo que imprime scripts/importar-series.ts (puro: arma el código de salida y las líneas; `emitir` las
 * escribe). Solo conteos, códigos de serie (son públicos: los del catálogo), fechas y códigos de error; nunca valores
 * ni el mensaje de un error (el de Prisma lleva el host de la base o la clave que chocó).
 *   0 bien · 3 con avisos (una serie con fallo o días que una revisión dejó sin vigente) · 2 uso o archivo ilegible ·
 *   1 CSV rechazado o error.
 * En producción (NODE_ENV=production, la imagen del migrador: `cargar-prod.sh`, §11 del runbook) todo fallo termina con
 * PARE_VIA_B y ningún texto invita a repetir por su cuenta. La frescura (si una serie está atrasada) la dice la lectura
 * (C5a), no la carga.
 */
import type { PrismaClient } from "@prisma/client";
import { PARE_VIA_B } from "../../cli/via-b";
import { detalleDeError } from "../../precios/guardar";
import { diaIso } from "../../precios/horario";
import { reporteErroresCsv } from "../../precios/reporte";
import type { ResultadoArchivo } from "../../lib/archivo-acotado";
import { USO_IMPORTAR_SERIES } from "./argumentos";
import { MAX_BYTES_CSV_SERIES, type LecturaCsvSeries } from "./csv-series";
import { guardarSeries, type BalanceSerie } from "./guardar";

export type LecturaValidaSeries = Extract<LecturaCsvSeries, { readonly ok: true }>;
export type LecturaInvalidaSeries = Extract<LecturaCsvSeries, { readonly ok: false }>;

export interface ResultadoImportacionSeries {
  readonly filas: number;
  readonly series: readonly BalanceSerie[];
}

export async function importarSeries(db: PrismaClient, csv: LecturaValidaSeries): Promise<ResultadoImportacionSeries> {
  const series = await guardarSeries(db, csv.series.map((s) => ({ codigo: s.codigo, fuente: s.fuente, valores: s.valores })));
  return { filas: csv.filas, series };
}

export interface OpcionesSalidaSeries {
  /** NODE_ENV=production: el CLI corre por la vía B (`cargar-prod.sh`). */
  readonly produccion: boolean;
}

export interface SalidaCliSeries {
  readonly codigoSalida: 0 | 1 | 2 | 3;
  /** Por stdout. */
  readonly lineas: readonly string[];
  /** Por stderr. */
  readonly errores: readonly string[];
}

export interface Consola {
  readonly log: (linea: string) => void;
  readonly error: (linea: string) => void;
}

const DEMASIADO_GRANDE = `❌ CSV_DEMASIADO_GRANDE · el archivo pasa de ${MAX_BYTES_CSV_SERIES} bytes; no se guardó nada.`;

/** Un fallo por stderr; en producción, su última línea pide parar la carga. */
function fallo(o: OpcionesSalidaSeries, codigoSalida: 1 | 2 | 3, textos: readonly string[], lineas: readonly string[] = []): SalidaCliSeries {
  return { codigoSalida, lineas, errores: o.produccion ? [...textos, PARE_VIA_B] : textos };
}

const conteos = (s: BalanceSerie): string =>
  `${s.fallo ? "⚠️ " : "✅"} ${s.codigo} · filas: ${s.filas} · nuevas: ${s.nuevas} · revisadas: ${s.revisadas} · retiradas: ${s.retiradas} · sin cambios: ${s.sinCambios} · último hasta: ${s.ultimoHasta ? diaIso(s.ultimoHasta) : "sin datos"}`;

function avisos(s: BalanceSerie, o: OpcionesSalidaSeries): string[] {
  const repetir = o.produccion ? "" : " Vuelva a correr el mismo CSV: completa sin duplicar.";
  return [
    ...(s.fallo ? [`⚠️  ${s.codigo} · ${s.fallo.codigo}${s.fallo.detalle ? ` · ${s.fallo.detalle}` : ""} · sin guardar: ${s.fallo.sinGuardar}.${repetir}`] : []),
    ...(s.diasDescubiertos > 0 ? [`⚠️  ${s.codigo} · ${s.diasDescubiertos} día(s) quedaron sin vigente al revisar: la fuente acortó una vigencia; revíselo antes de usar la serie.`] : []),
  ];
}

export function salidaImportacion(r: ResultadoImportacionSeries, o: OpcionesSalidaSeries): SalidaCliSeries {
  const lineas = [`📄 CSV de series · filas: ${r.filas} · series: ${r.series.length}`, ...r.series.map(conteos)];
  const textos = r.series.flatMap((s) => avisos(s, o));
  return textos.length === 0 ? { codigoSalida: 0, lineas, errores: [] } : fallo(o, 3, textos, lineas);
}

export function salidaUso(mensaje: string, o: OpcionesSalidaSeries): SalidaCliSeries {
  return fallo(o, 2, [`❌ ${mensaje}`, USO_IMPORTAR_SERIES]);
}

export function salidaArchivo(codigo: Extract<ResultadoArchivo, { readonly ok: false }>["codigo"], o: OpcionesSalidaSeries): SalidaCliSeries {
  if (codigo === "ARCHIVO_DEMASIADO_GRANDE") return fallo(o, 1, [DEMASIADO_GRANDE]);
  return fallo(o, 2, [`❌ ${codigo} · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base.`]);
}

export function salidaCsvInvalido(csv: LecturaInvalidaSeries, o: OpcionesSalidaSeries): SalidaCliSeries {
  return fallo(o, 1, csv.codigo === "CSV_DEMASIADO_GRANDE" ? [DEMASIADO_GRANDE] : reporteErroresCsv(csv));
}

/** Lo que falla fuera del camino de guardado (abrir o cerrar la base, escribir la salida). */
export function salidaInesperada(e: unknown, o: OpcionesSalidaSeries): SalidaCliSeries {
  return fallo(o, 1, [`❌ La importación de series falló: ${detalleDeError(e)}.`]);
}

/** Escribe las líneas (stdout) y los errores (stderr), en ese orden, y devuelve el código de salida. */
export function emitir(s: SalidaCliSeries, consola: Consola): number {
  for (const linea of s.lineas) consola.log(linea);
  for (const linea of s.errores) consola.error(linea);
  return s.codigoSalida;
}
