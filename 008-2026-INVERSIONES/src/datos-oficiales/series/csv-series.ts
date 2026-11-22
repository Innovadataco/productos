/**
 * El CSV canónico de series oficiales (fase C, C2a). Lo escriben los exportadores del Mac (C2b la TRM de la SFC, C2c
 * las tasas de BanRep, C2d el IPC del DANE: el XML y el xlsx se leen SOLO allí) y lo lee `importar-series` en
 * producción (vía B, sin red). Puro: ni base ni sistema de archivos. El mismo módulo escribe y lee, así el importador
 * acepta todo lo que el exportador escribe (prueba de ida y vuelta).
 *
 * Formato exacto (lo documentará también produccion.md §11, en C8):
 * - Solo ASCII imprimible (0x20–0x7E) y LF: sin BOM, CR, tabuladores ni comillas. Separador coma.
 * - Primera línea, exacta: `serie,desde,hasta,valor,fuente`. Después, una línea por vigencia publicada.
 * - Cada línea (también la última) termina en LF; sin líneas vacías; a lo sumo MAX_LARGO_LINEA_SERIES bytes.
 * - `serie`: un código del catálogo (src/datos-oficiales/catalogo.ts); `fuente`: exactamente la de esa serie.
 * - `desde`, `hasta`: `19AA-MM-DD` o `20AA-MM-DD`, fechas que existen, con la forma de vigencia de la serie (DIA, TRAMO
 *   de hasta `maxDias` días o MES del día 1 al último, ya terminado: `hasta` < hoy). `desde` ≤ hoy + el adelanto de la
 *   serie (la TRM se publica por adelantado; las demás, no).
 * - `valor`: decimal canónico (sin signo, ceros sobrantes ni exponente; hasta 12 enteros), con a lo sumo los decimales
 *   de la escala de la serie y dentro de su rango de cordura. Se compara como texto, nunca con Number.
 * - Ninguna serie con dos vigencias que empiecen el mismo día (FILA_REPETIDA) o que se solapen (SOLAPE, en la línea que
 *   aparece después); al menos una fila; topes de bytes, filas y series.
 * Topes: con líneas de ~76 bytes (la IBR, la más larga del catálogo) el que muerde primero es el de bytes (unas 27 000
 * filas en 2 MiB); el de filas solo se alcanza con líneas de 52 bytes o menos (la TRM tiene ~48).
 * La lectura es todo o nada: con un error no se entrega ninguna fila. Los errores traen solo número de línea y código,
 * nunca la serie, la fecha ni el valor. Se deja de leer al pasar el tope de filas o al llegar a MAX_ERRORES_CONTADOS.
 */
import { CATALOGO, type FormaVigencia, type SerieCatalogo } from "../catalogo";
import { leerFechaIso } from "../../importacion/trii/valores";
import { MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS } from "../../precios/csv-cierres";
import { diaIso } from "../../precios/horario";

export const ENCABEZADO_CSV_SERIES = "serie,desde,hasta,valor,fuente";
export const MAX_BYTES_CSV_SERIES = 2 * 1024 * 1024;
export const MAX_FILAS_CSV_SERIES = 40_000;
export const MAX_SERIES_CSV = 10;
export const MAX_LARGO_LINEA_SERIES = 120;

const FECHA = /^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$/;
/** Decimal canónico de la base (DECIMAL(20,8): hasta 12 enteros); la escala de la serie se mira aparte. */
const VALOR_CANONICO = /^(0|[1-9][0-9]{0,11})(\.[0-9]*[1-9])?$/;
const DECIMAL = /^([0-9]+)(?:\.([0-9]+))?$/;
const COLUMNAS = 5;
const LF = 0x0a;
const IMPRIMIBLE_MIN = 0x20;
const IMPRIMIBLE_MAX = 0x7e;
const DIA_MS = 86_400_000;

export type CodigoLineaSeries =
  | "VACIO" | "NO_ASCII" | "SIN_FIN_DE_LINEA" | "LINEA_VACIA" | "LINEA_DEMASIADO_LARGA" | "ENCABEZADO" | "COLUMNAS"
  | "SERIE_DESCONOCIDA" | "FUENTE_DISTINTA" | "FECHA_FORMATO" | "FECHA_INVALIDA" | "VIGENCIA_FORMA" | "FECHA_FUTURA" | "MES_ABIERTO"
  | "VALOR_FORMATO" | "VALOR_ESCALA" | "VALOR_FUERA_DE_RANGO" | "FILA_REPETIDA" | "SOLAPE" | "SIN_FILAS" | "DEMASIADAS_FILAS" | "DEMASIADAS_SERIES";

export interface ErrorLineaSeries {
  readonly linea: number;
  readonly codigo: CodigoLineaSeries;
}

/** Una vigencia publicada: del `desde` al `hasta` (los dos incluidos, a medianoche UTC) vale `valor` (decimal canónico). */
export interface ValorSerie {
  readonly desde: Date;
  readonly hasta: Date;
  readonly valor: string;
}

/** Las vigencias de una serie, ordenadas por desde; `primeraLinea` la ubica en el archivo. */
export interface SerieCsv {
  readonly codigo: string;
  readonly fuente: string;
  readonly primeraLinea: number;
  readonly valores: readonly ValorSerie[];
}

export type LecturaCsvSeries =
  | { readonly ok: true; readonly series: readonly SerieCsv[]; readonly filas: number }
  | { readonly ok: false; readonly codigo: "CSV_DEMASIADO_GRANDE" | "CSV_INVALIDO"; readonly errores: readonly ErrorLineaSeries[]; readonly totalErrores: number };

/** El decimal sin ceros sobrantes (a la izquierda del entero ni a la derecha de la fracción), o null si no es uno. */
export function canonizarValor(texto: string): string | null {
  const m = DECIMAL.exec(texto);
  if (!m) return null;
  const entero = m[1]!.replace(/^0+(?=[0-9])/, "");
  const fraccion = (m[2] ?? "").replace(/0+$/, "");
  return fraccion === "" ? entero : `${entero}.${fraccion}`;
}

/** Compara dos decimales canónicos (los que deja canonizarValor) como texto: −1, 0 o 1. */
export function compararDecimales(a: string, b: string): -1 | 0 | 1 {
  const [enteroA = "", fraccionA = ""] = a.split(".");
  const [enteroB = "", fraccionB = ""] = b.split(".");
  if (enteroA.length !== enteroB.length) return enteroA.length < enteroB.length ? -1 : 1;
  if (enteroA !== enteroB) return enteroA < enteroB ? -1 : 1;
  const largo = Math.max(fraccionA.length, fraccionB.length);
  const [fa, fb] = [fraccionA.padEnd(largo, "0"), fraccionB.padEnd(largo, "0")];
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

type Campo<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly codigo: CodigoLineaSeries };
const mal = (codigo: CodigoLineaSeries): Campo<never> => ({ ok: false, codigo });
const bien = <T>(valor: T): Campo<T> => ({ ok: true, valor });

function leerFecha(texto: string): Campo<Date> {
  if (!FECHA.test(texto)) return mal("FECHA_FORMATO");
  const r = leerFechaIso(texto);
  return r.ok ? bien(r.valor) : mal("FECHA_INVALIDA");
}

const ultimoDelMes = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);

function tieneLaForma(forma: FormaVigencia, desde: Date, hasta: Date): boolean {
  const dias = (hasta.getTime() - desde.getTime()) / DIA_MS + 1;
  if (forma.tipo === "DIA") return dias === 1;
  if (forma.tipo === "TRAMO") return dias >= 1 && dias <= forma.maxDias;
  return desde.getUTCDate() === 1 && hasta.getTime() === ultimoDelMes(desde);
}

function leerValor(texto: string, serie: SerieCatalogo): Campo<string> {
  if (!VALOR_CANONICO.test(texto)) return mal("VALOR_FORMATO");
  if ((texto.split(".")[1] ?? "").length > serie.escala) return mal("VALOR_ESCALA");
  const dentro = compararDecimales(texto, serie.rango.min) >= 0 && compararDecimales(texto, serie.rango.max) <= 0;
  return dentro ? bien(texto) : mal("VALOR_FUERA_DE_RANGO");
}

interface FilaSerie {
  readonly serie: SerieCatalogo;
  readonly valor: ValorSerie;
}

/** La vigencia: sus dos fechas, la forma de la serie, el adelanto y, si es un mes, que ya terminó. */
function leerVigencia(serie: SerieCatalogo, desdeTexto: string, hastaTexto: string, hoy: Date): Campo<{ desde: Date; hasta: Date }> {
  const desde = leerFecha(desdeTexto);
  if (!desde.ok) return desde;
  const hasta = leerFecha(hastaTexto);
  if (!hasta.ok) return hasta;
  if (!tieneLaForma(serie.vigencia, desde.valor, hasta.valor)) return mal("VIGENCIA_FORMA");
  if (desde.valor.getTime() > hoy.getTime() + serie.adelantoMaximoDias * DIA_MS) return mal("FECHA_FUTURA");
  if (serie.vigencia.tipo === "MES" && hasta.valor.getTime() >= hoy.getTime()) return mal("MES_ABIERTO");
  return bien({ desde: desde.valor, hasta: hasta.valor });
}

/** Una fila de datos (ya sabida ASCII y de largo válido): su serie y su vigencia, o el primer campo que falla. */
function leerFila(linea: string, hoy: Date, catalogo: ReadonlyMap<string, SerieCatalogo>): Campo<FilaSerie> {
  const campos = linea.split(",");
  if (campos.length !== COLUMNAS) return mal("COLUMNAS");
  const [codigo, desdeTexto, hastaTexto, valorTexto, fuente] = campos as [string, string, string, string, string];
  const serie = catalogo.get(codigo);
  if (!serie) return mal("SERIE_DESCONOCIDA");
  if (fuente !== serie.fuente) return mal("FUENTE_DISTINTA");
  const vigencia = leerVigencia(serie, desdeTexto, hastaTexto, hoy);
  if (!vigencia.ok) return vigencia;
  const valor = leerValor(valorTexto, serie);
  if (!valor.ok) return valor;
  return bien({ serie, valor: { ...vigencia.valor, valor: valor.valor } });
}

const esImprimible = (b: number): boolean => b >= IMPRIMIBLE_MIN && b <= IMPRIMIBLE_MAX;

interface Linea {
  readonly numero: number;
  readonly texto: string;
  /** El código de forma que ya la descarta (no ASCII, vacía o larga), o null. */
  readonly codigo: CodigoLineaSeries | null;
  /** La última línea del archivo, sin LF al final. */
  readonly sinLf: boolean;
}

/** Las líneas del archivo de una en una (sin su LF), sin armar un arreglo: la memoria no crece con las líneas. */
function* lineasDe(bytes: Uint8Array): Generator<Linea> {
  let inicio = 0;
  let numero = 0;
  while (inicio < bytes.length) {
    const lf = bytes.indexOf(LF, inicio);
    const fin = lf === -1 ? bytes.length : lf;
    const trozo = bytes.subarray(inicio, fin);
    const codigo = !trozo.every(esImprimible) ? "NO_ASCII" : trozo.length === 0 ? "LINEA_VACIA" : trozo.length > MAX_LARGO_LINEA_SERIES ? "LINEA_DEMASIADO_LARGA" : null;
    numero += 1;
    yield { numero, texto: codigo === null ? String.fromCharCode(...trozo) : "", codigo, sinLf: lf === -1 };
    inicio = fin + 1;
  }
}

/** Acumula errores: guarda los primeros MAX_ERRORES_LISTADOS y cuenta hasta MAX_ERRORES_CONTADOS (ahí se deja de leer). */
class Errores {
  readonly lista: ErrorLineaSeries[] = [];
  total = 0;
  agregar(linea: number, codigo: CodigoLineaSeries): void {
    this.total += 1;
    if (this.lista.length < MAX_ERRORES_LISTADOS) this.lista.push({ linea, codigo });
  }
  get colmado(): boolean {
    return this.total >= MAX_ERRORES_CONTADOS;
  }
}

interface ValorConLinea {
  readonly valor: ValorSerie;
  readonly linea: number;
}

interface Acumulado {
  readonly series: Map<string, { readonly fuente: string; readonly primeraLinea: number; readonly valores: ValorConLinea[] }>;
  readonly vistas: Set<string>;
  filas: number;
}

/** Suma la fila a su serie; el código si no se puede (forma, repetida o una serie de más). */
function agregarFila(texto: string, numero: number, acc: Acumulado, hoy: Date, catalogo: ReadonlyMap<string, SerieCatalogo>): CodigoLineaSeries | null {
  const fila = leerFila(texto, hoy, catalogo);
  if (!fila.ok) return fila.codigo;
  const { serie, valor } = fila.valor;
  const clave = `${serie.codigo}|${valor.desde.getTime()}`;
  if (acc.vistas.has(clave)) return "FILA_REPETIDA";
  const actual = acc.series.get(serie.codigo);
  if (!actual && acc.series.size >= MAX_SERIES_CSV) return "DEMASIADAS_SERIES";
  acc.vistas.add(clave);
  if (actual) actual.valores.push({ valor, linea: numero });
  else acc.series.set(serie.codigo, { fuente: serie.fuente, primeraLinea: numero, valores: [{ valor, linea: numero }] });
  return null;
}

/** Valida una fila de datos y la suma; false si ya no se debe seguir leyendo (tope de filas). */
function sumarFila(texto: string, numero: number, acc: Acumulado, errores: Errores, hoy: Date, catalogo: ReadonlyMap<string, SerieCatalogo>): boolean {
  if (acc.filas >= MAX_FILAS_CSV_SERIES) {
    errores.agregar(numero, "DEMASIADAS_FILAS");
    return false;
  }
  acc.filas += 1;
  const codigo = agregarFila(texto, numero, acc, hoy, catalogo);
  if (codigo) errores.agregar(numero, codigo);
  return true;
}

const porDesde = (a: ValorConLinea, b: ValorConLinea): number => a.valor.desde.getTime() - b.valor.desde.getTime();

/** Dos vigencias de una misma serie que se solapan: SOLAPE en la línea que aparece después en el archivo. */
function buscarSolapes(acc: Acumulado, errores: Errores): void {
  for (const serie of acc.series.values()) {
    const ordenadas = [...serie.valores].sort(porDesde);
    let previa = ordenadas[0];
    for (const actual of ordenadas.slice(1)) {
      if (previa && actual.valor.desde.getTime() <= previa.valor.hasta.getTime()) {
        errores.agregar(Math.max(previa.linea, actual.linea), "SOLAPE");
        if (actual.valor.hasta.getTime() <= previa.valor.hasta.getTime()) continue;
      }
      previa = actual;
    }
  }
}

function resultado(acc: Acumulado): LecturaCsvSeries {
  const series = [...acc.series].map(([codigo, s]) => ({ codigo, fuente: s.fuente, primeraLinea: s.primeraLinea, valores: [...s.valores].sort(porDesde).map((v) => v.valor) }));
  return { ok: true, series, filas: acc.filas };
}

const invalido = (errores: Errores): LecturaCsvSeries => ({
  ok: false, codigo: "CSV_INVALIDO", errores: [...errores.lista].sort((a, b) => a.linea - b.linea), totalErrores: errores.total,
});

/**
 * Lee y valida el CSV entero. Todo o nada. `hoy` es la fecha de negocio en Colombia (fechaEnBogota), tope del
 * adelanto. `catalogo` es el de 008; se inyecta solo en las pruebas.
 */
export function leerCsvSeries(bytes: Uint8Array, hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): LecturaCsvSeries {
  if (bytes.length > MAX_BYTES_CSV_SERIES) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 };
  const errores = new Errores();
  if (bytes.length === 0) return (errores.agregar(1, "VACIO"), invalido(errores));
  const porCodigo = new Map(catalogo.map((s) => [s.codigo, s]));
  const acc: Acumulado = { series: new Map(), vistas: new Set(), filas: 0 };
  let ultima = 0;
  let completo = true;
  for (const l of lineasDe(bytes)) {
    ultima = l.numero;
    if (l.codigo !== null) errores.agregar(l.numero, l.codigo);
    else if (l.numero === 1) {
      if (l.texto !== ENCABEZADO_CSV_SERIES) errores.agregar(l.numero, "ENCABEZADO");
    } else if (!sumarFila(l.texto, l.numero, acc, errores, hoy, porCodigo)) {
      completo = false;
      break;
    }
    if (l.sinLf) errores.agregar(l.numero, "SIN_FIN_DE_LINEA");
    if (errores.colmado) {
      completo = false;
      break;
    }
  }
  if (completo) buscarSolapes(acc, errores);
  if (errores.total === 0 && acc.filas === 0) errores.agregar(ultima + 1, "SIN_FILAS");
  return errores.total > 0 ? invalido(errores) : resultado(acc);
}

export interface SerieAEscribir {
  readonly codigo: string;
  readonly valores: readonly ValorSerie[];
}

export type EscrituraCsvSeries =
  | { readonly ok: true; readonly texto: string; readonly filas: number }
  | { readonly ok: false; readonly codigo: "SIN_FILAS" | "CSV_DEMASIADO_GRANDE" | "FILA_INVALIDA" };

/**
 * Escribe el CSV de las series, en el orden dado y con la fuente del catálogo. Antes de entregarlo lo vuelve a leer:
 * nunca escribe un CSV que el importador rechazaría (una fila inválida o un tope pasado se informan con su código).
 */
export function escribirCsvSeries(series: readonly SerieAEscribir[], hoy: Date, catalogo: readonly SerieCatalogo[] = CATALOGO): EscrituraCsvSeries {
  const total = series.reduce((suma, s) => suma + s.valores.length, 0);
  if (total === 0) return { ok: false, codigo: "SIN_FILAS" };
  if (total > MAX_FILAS_CSV_SERIES) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE" };
  const fuentes = new Map(catalogo.map((s) => [s.codigo, s.fuente]));
  const filas = series.flatMap((s) => s.valores.map((v) => `${s.codigo},${diaIso(v.desde)},${diaIso(v.hasta)},${v.valor},${fuentes.get(s.codigo) ?? ""}`));
  const texto = `${[ENCABEZADO_CSV_SERIES, ...filas].join("\n")}\n`;
  const bytes = new TextEncoder().encode(texto);
  if (bytes.length > MAX_BYTES_CSV_SERIES) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE" };
  const comprobado = leerCsvSeries(bytes, hoy, catalogo);
  return comprobado.ok ? { ok: true, texto, filas: filas.length } : { ok: false, codigo: "FILA_INVALIDA" };
}
