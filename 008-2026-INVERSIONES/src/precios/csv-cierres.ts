/**
 * El CSV de cierres públicos de Yahoo que viaja del Mac (`precios:exportar`, con red) a producción
 * (`precios:importar`, sin red). Puro: ni base ni sistema de archivos. El mismo módulo escribe y lee, así
 * el importador acepta todo lo que el exportador escribe (prueba de ida y vuelta).
 *
 * Formato exacto (documentado también en docs/despliegue/produccion.md §11):
 * - Solo ASCII imprimible (0x20–0x7E) y LF: sin BOM, CR, tabuladores ni comillas. Separador coma.
 * - Primera línea, exacta: `nemotecnico,fecha,cierre,volumen`. Después, una línea por barra diaria.
 * - Cada línea (también la última) termina en LF; sin líneas vacías; a lo sumo MAX_LARGO_LINEA bytes.
 * - `nemotecnico`: `[A-Z0-9]{2,20}` (como lo guarda la importación de Trii).
 * - `fecha`: `20AA-MM-DD`, una fecha que existe (de negocio en Colombia).
 * - `cierre`: decimal canónico, el texto que deja `parsearYahoo` (sin ceros sobrantes, hasta 6 decimales,
 *   sin exponente), > 0 y ≤ PRECIO_MAXIMO_COP.
 * - `volumen`: vacío (Yahoo no lo trajo) o un entero ≥ 0 de hasta 15 dígitos, sin ceros a la izquierda.
 * - Ningún par (nemotécnico, fecha) repetido; al menos una fila; topes de bytes, filas y especies.
 * Si un día es hábil, si ya es definitivo o si tuvo negociación no lo decide el CSV: lo decide quien guarda
 * (`motivoOmision`, en `guardar.ts`), igual que con Yahoo directo.
 * La lectura es todo o nada: con un error no se entrega ninguna fila. Los errores traen solo número de línea
 * y código, nunca la especie, la fecha ni el precio.
 */
import { leerFechaIso } from "../importacion/trii/valores";
import { PRECIO_MAXIMO_COP, type Cierre } from "./yahoo";

export const ENCABEZADO_CSV = "nemotecnico,fecha,cierre,volumen";
/** Tope del archivo: 60 000 filas de a lo sumo ~63 bytes caben en ~3,8 MB (cálculo, no medición). */
export const MAX_BYTES_CSV = 4 * 1024 * 1024;
export const MAX_FILAS_CSV = 60_000;
export const MAX_ESPECIES_CSV = 40;
export const MAX_LARGO_LINEA = 80;
export const MAX_ERRORES_LISTADOS = 20;

const NEMOTECNICO = /^[A-Z0-9]{2,20}$/;
const FECHA = /^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/;
const CIERRE = /^(0|[1-9][0-9]{0,7})(\.[0-9]{0,5}[1-9])?$/;
const VOLUMEN = /^(0|[1-9][0-9]{0,14})$/;
const VOLUMEN_MAXIMO = 999_999_999_999_999;
const LF = 0x0a;
const IMPRIMIBLE_MIN = 0x20;
const IMPRIMIBLE_MAX = 0x7e;

export type CodigoLinea =
  | "VACIO" | "NO_ASCII" | "SIN_FIN_DE_LINEA" | "LINEA_VACIA" | "LINEA_DEMASIADO_LARGA" | "ENCABEZADO" | "COLUMNAS"
  | "NEMOTECNICO_FORMATO" | "FECHA_FORMATO" | "FECHA_INVALIDA" | "CIERRE_FORMATO" | "CIERRE_FUERA_DE_RANGO" | "VOLUMEN_FORMATO"
  | "FILA_REPETIDA" | "SIN_FILAS" | "DEMASIADAS_FILAS" | "DEMASIADAS_ESPECIES";

export interface ErrorLinea {
  readonly linea: number;
  readonly codigo: CodigoLinea;
}

/** Los cierres de una especie, por fecha; `primeraLinea` la identifica en los avisos sin nombrarla. */
export interface EspecieCsv {
  readonly nemotecnico: string;
  readonly primeraLinea: number;
  readonly cierres: readonly Cierre[];
}

export type ResultadoLectura =
  | { readonly ok: true; readonly especies: readonly EspecieCsv[]; readonly filas: number; readonly desde: Date; readonly hasta: Date }
  | { readonly ok: false; readonly codigo: "CSV_DEMASIADO_GRANDE" | "CSV_INVALIDO"; readonly errores: readonly ErrorLinea[]; readonly totalErrores: number };

/** ¿Este volumen de Yahoo cabe en el CSV? null (no vino) o un entero seguro de 0 a 15 dígitos. */
export function volumenExportable(v: number | null): boolean {
  return v === null || (Number.isSafeInteger(v) && v >= 0 && v <= VOLUMEN_MAXIMO);
}

type Campo<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly codigo: CodigoLinea };

function leerFecha(texto: string): Campo<Date> {
  if (!FECHA.test(texto)) return { ok: false, codigo: "FECHA_FORMATO" };
  const r = leerFechaIso(texto);
  return r.ok ? r : { ok: false, codigo: "FECHA_INVALIDA" };
}

function leerCierre(texto: string): Campo<string> {
  if (!CIERRE.test(texto)) return { ok: false, codigo: "CIERRE_FORMATO" };
  const n = Number(texto);
  return n > 0 && n <= PRECIO_MAXIMO_COP ? { ok: true, valor: texto } : { ok: false, codigo: "CIERRE_FUERA_DE_RANGO" };
}

function leerVolumen(texto: string): Campo<number | null> {
  if (texto === "") return { ok: true, valor: null };
  return VOLUMEN.test(texto) ? { ok: true, valor: Number(texto) } : { ok: false, codigo: "VOLUMEN_FORMATO" };
}

/** Una fila de datos (ya sabida ASCII y de largo válido): su especie y su cierre, o el primer campo que falla. */
function leerFila(linea: string): Campo<{ readonly nemotecnico: string; readonly cierre: Cierre }> {
  const campos = linea.split(",");
  if (campos.length !== 4) return { ok: false, codigo: "COLUMNAS" };
  const [nemotecnico, fechaTexto, cierreTexto, volumenTexto] = campos as [string, string, string, string];
  if (!NEMOTECNICO.test(nemotecnico)) return { ok: false, codigo: "NEMOTECNICO_FORMATO" };
  const fecha = leerFecha(fechaTexto);
  if (!fecha.ok) return fecha;
  const precio = leerCierre(cierreTexto);
  if (!precio.ok) return precio;
  const volumen = leerVolumen(volumenTexto);
  if (!volumen.ok) return volumen;
  return { ok: true, valor: { nemotecnico, cierre: { fecha: fecha.valor, precio: precio.valor, volumen: volumen.valor } } };
}

const esImprimible = (b: number): boolean => b >= IMPRIMIBLE_MIN && b <= IMPRIMIBLE_MAX;

/** Las líneas del archivo (sin su LF) con el código de forma que ya las descarta, si lo hay. */
function partirLineas(bytes: Uint8Array): { readonly lineas: readonly { texto: string; codigo: CodigoLinea | null }[]; readonly terminaEnLf: boolean } {
  const lineas: { texto: string; codigo: CodigoLinea | null }[] = [];
  let inicio = 0;
  for (let i = 0; i <= bytes.length; i += 1) {
    if (i < bytes.length && bytes[i] !== LF) continue;
    if (i === bytes.length && inicio === bytes.length) break; // terminó en LF: no hay una línea más
    const trozo = bytes.subarray(inicio, i);
    const codigo = !trozo.every(esImprimible) ? "NO_ASCII" : trozo.length === 0 ? "LINEA_VACIA" : trozo.length > MAX_LARGO_LINEA ? "LINEA_DEMASIADO_LARGA" : null;
    lineas.push({ texto: codigo === null ? String.fromCharCode(...trozo) : "", codigo });
    inicio = i + 1;
  }
  return { lineas, terminaEnLf: bytes.length > 0 && bytes[bytes.length - 1] === LF };
}

/** Acumula errores: guarda los primeros MAX_ERRORES_LISTADOS y cuenta todos. */
class Errores {
  readonly lista: ErrorLinea[] = [];
  total = 0;
  agregar(linea: number, codigo: CodigoLinea): void {
    this.total += 1;
    if (this.lista.length < MAX_ERRORES_LISTADOS) this.lista.push({ linea, codigo });
  }
}

interface Acumulado {
  readonly especies: Map<string, { primeraLinea: number; cierres: Cierre[] }>;
  readonly vistas: Set<string>;
  filas: number;
}

/** Valida una fila de datos y la suma al acumulado; false si ya no se debe seguir leyendo (tope de filas). */
function sumarFila(texto: string, numero: number, acc: Acumulado, errores: Errores): boolean {
  if (acc.filas >= MAX_FILAS_CSV) {
    errores.agregar(numero, "DEMASIADAS_FILAS");
    return false;
  }
  acc.filas += 1;
  const codigo = agregarFila(texto, numero, acc);
  if (codigo) errores.agregar(numero, codigo);
  return true;
}

/** Suma la fila a su especie; el código si no se puede (forma, repetida o una especie de más). */
function agregarFila(texto: string, numero: number, acc: Acumulado): CodigoLinea | null {
  const fila = leerFila(texto);
  if (!fila.ok) return fila.codigo;
  const { nemotecnico, cierre } = fila.valor;
  const clave = `${nemotecnico}|${cierre.fecha.getTime()}`;
  if (acc.vistas.has(clave)) return "FILA_REPETIDA";
  acc.vistas.add(clave);
  const especie = acc.especies.get(nemotecnico);
  if (especie) {
    especie.cierres.push(cierre);
    return null;
  }
  if (acc.especies.size >= MAX_ESPECIES_CSV) return "DEMASIADAS_ESPECIES";
  acc.especies.set(nemotecnico, { primeraLinea: numero, cierres: [cierre] });
  return null;
}

function resultado(acc: Acumulado): ResultadoLectura {
  const especies = [...acc.especies].map(([nemotecnico, e]) => ({
    nemotecnico, primeraLinea: e.primeraLinea, cierres: [...e.cierres].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
  }));
  // Cada especie ya está ordenada: sus extremos dan el rango (sin esparcir 60 000 valores en Math.min).
  const desde = especies.reduce((m, e) => Math.min(m, e.cierres[0]!.fecha.getTime()), Number.POSITIVE_INFINITY);
  const hasta = especies.reduce((m, e) => Math.max(m, e.cierres.at(-1)!.fecha.getTime()), Number.NEGATIVE_INFINITY);
  return { ok: true, especies, filas: acc.filas, desde: new Date(desde), hasta: new Date(hasta) };
}

const invalido = (errores: Errores): ResultadoLectura => ({ ok: false, codigo: "CSV_INVALIDO", errores: errores.lista, totalErrores: errores.total });

/** Lee y valida el CSV entero. Todo o nada. */
export function leerCsvCierres(bytes: Uint8Array): ResultadoLectura {
  if (bytes.length > MAX_BYTES_CSV) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 };
  const errores = new Errores();
  if (bytes.length === 0) return (errores.agregar(1, "VACIO"), invalido(errores));
  const { lineas, terminaEnLf } = partirLineas(bytes);
  const acc: Acumulado = { especies: new Map(), vistas: new Set(), filas: 0 };
  for (const [i, l] of lineas.entries()) {
    const numero = i + 1;
    if (l.codigo !== null) errores.agregar(numero, l.codigo);
    else if (numero === 1) {
      if (l.texto !== ENCABEZADO_CSV) errores.agregar(numero, "ENCABEZADO");
    } else if (!sumarFila(l.texto, numero, acc, errores)) break;
  }
  if (!terminaEnLf) errores.agregar(lineas.length, "SIN_FIN_DE_LINEA");
  if (errores.total === 0 && acc.filas === 0) errores.agregar(lineas.length + 1, "SIN_FILAS");
  return errores.total > 0 ? invalido(errores) : resultado(acc);
}

export type ResultadoEscritura =
  | { readonly ok: true; readonly texto: string; readonly filas: number }
  | { readonly ok: false; readonly codigo: "SIN_FILAS" | "CSV_DEMASIADO_GRANDE" | "FILA_INVALIDA" };

const textoVolumen = (v: number | null): string => (v === null ? "" : String(v));

/**
 * Escribe el CSV de las especies, en el orden dado. Antes de entregarlo lo vuelve a leer: nunca escribe un
 * CSV que el importador rechazaría (una fila inválida o un tope pasado se informan con su código).
 */
export function escribirCsvCierres(especies: readonly { readonly nemotecnico: string; readonly cierres: readonly Cierre[] }[]): ResultadoEscritura {
  const filas = especies.flatMap((e) => e.cierres.map((c) => ({ nemotecnico: e.nemotecnico, c })));
  if (filas.length === 0) return { ok: false, codigo: "SIN_FILAS" };
  if (filas.length > MAX_FILAS_CSV) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE" };
  if (filas.some(({ c }) => !volumenExportable(c.volumen))) return { ok: false, codigo: "FILA_INVALIDA" };
  const lineas = filas.map(({ nemotecnico, c }) => `${nemotecnico},${c.fecha.toISOString().slice(0, 10)},${c.precio},${textoVolumen(c.volumen)}`);
  const texto = `${[ENCABEZADO_CSV, ...lineas].join("\n")}\n`;
  const comprobado = leerCsvCierres(new TextEncoder().encode(texto));
  if (comprobado.ok) return { ok: true, texto, filas: filas.length };
  return { ok: false, codigo: comprobado.codigo === "CSV_DEMASIADO_GRANDE" ? "CSV_DEMASIADO_GRANDE" : "FILA_INVALIDA" };
}
