/**
 * El CSV de valores de unidad del fondo (SFC, qhpu-8ixx) que viaja del Mac (`fondo:exportar`, con red) a producción
 * (`importar-valores-fondo`, sin red). Puro: ni base ni sistema de archivos. El mismo módulo escribe y lee, así el
 * importador acepta todo lo que el exportador escribe (prueba de ida y vuelta).
 *
 * Formato exacto (documentado también en docs/despliegue/produccion.md §11):
 * - Solo ASCII imprimible (0x20–0x7E) y LF: sin BOM, CR, tabuladores ni comillas. Separador coma.
 * - Primera línea, exacta: `codigo_fic,participacion,fecha,valor_unidad,valor_fondo`. Después, una línea por día.
 * - Cada línea (también la última) termina en LF; sin líneas vacías; a lo sumo MAX_LARGO_LINEA_FONDO bytes.
 * - `codigo_fic`: el `codigo_negocio` de la SFC, de 1 a 12 dígitos (CODIGO_FIC_RE).
 * - `participacion`: vacío (sin clase) o la clase `tipo_participacion`, de 1 a 6 dígitos (PARTICIPACION_RE). Un
 *   mismo fondo lleva siempre la misma.
 * - `fecha`: `20AA-MM-DD`, una fecha que existe y no es posterior a hoy.
 * - `valor_unidad`: el texto canónico que deja `leerValorUnidad` (sin ceros sobrantes ni exponente, hasta 8
 *   decimales), > 0 y ≤ VALOR_UNIDAD_MAXIMO_COP.
 * - `valor_fondo`: vacío (la SFC no lo trajo o no sirve) o el texto canónico de `leerValorFondo` (hasta 4 decimales).
 * - Ningún par (fondo, fecha) repetido; al menos una fila; topes de bytes, filas y fondos.
 * La lectura es todo o nada: con un error no se entrega ninguna fila. Los errores traen solo número de línea y
 * código, nunca el código del fondo, la clase, la fecha ni el valor. Se deja de leer al pasar el tope de filas o al
 * llegar a MAX_ERRORES_CONTADOS errores (los mismos topes de informe que el CSV de cierres).
 */
import { leerFechaIso } from "../importacion/trii/valores";
import { MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS } from "../precios/csv-cierres";
import { CODIGO_FIC_RE, PARTICIPACION_RE, isoDia, leerValorFondo, leerValorUnidad, type ValorDia } from "./sfc";

export const ENCABEZADO_CSV_FONDO = "codigo_fic,participacion,fecha,valor_unidad,valor_fondo";
/** Tope del archivo: 20 000 filas de a lo sumo 81 bytes caben en ~1,6 MB (cálculo; la prueba lo comprueba). */
export const MAX_BYTES_CSV_FONDO = 2 * 1024 * 1024;
export const MAX_FILAS_CSV_FONDO = 20_000;
export const MAX_FONDOS_CSV = 10;
export const MAX_LARGO_LINEA_FONDO = 80;

const FECHA = /^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/;
/** Decimal canónico: sin ceros a la izquierda ni sobrantes; hasta 8 (unidad) o 4 (fondo) decimales. */
const VALOR_UNIDAD = /^(0|[1-9][0-9]{0,29})(\.[0-9]{0,7}[1-9])?$/;
const VALOR_FONDO = /^(0|[1-9][0-9]{0,29})(\.[0-9]{0,3}[1-9])?$/;
const COLUMNAS = 5;
const LF = 0x0a;
const IMPRIMIBLE_MIN = 0x20;
const IMPRIMIBLE_MAX = 0x7e;

export type CodigoLineaFondo =
  | "VACIO" | "NO_ASCII" | "SIN_FIN_DE_LINEA" | "LINEA_VACIA" | "LINEA_DEMASIADO_LARGA" | "ENCABEZADO" | "COLUMNAS"
  | "CODIGO_FIC_FORMATO" | "PARTICIPACION_FORMATO" | "FECHA_FORMATO" | "FECHA_INVALIDA" | "FECHA_FUTURA"
  | "VALOR_UNIDAD_FORMATO" | "VALOR_UNIDAD_FUERA_DE_RANGO" | "VALOR_FONDO_FORMATO" | "VALOR_FONDO_FUERA_DE_RANGO"
  | "PARTICIPACION_DISTINTA" | "FILA_REPETIDA" | "SIN_FILAS" | "DEMASIADAS_FILAS" | "DEMASIADOS_FONDOS";

export interface ErrorLineaFondo {
  readonly linea: number;
  readonly codigo: CodigoLineaFondo;
}

/** Los valores de un fondo, por fecha; `primeraLinea` lo identifica en los avisos sin nombrarlo. */
export interface FondoCsv {
  readonly codigoFic: string;
  readonly participacion: string | null;
  readonly primeraLinea: number;
  readonly valores: readonly ValorDia[];
}

export type LecturaCsvFondo =
  | { readonly ok: true; readonly fondos: readonly FondoCsv[]; readonly filas: number; readonly desde: Date; readonly hasta: Date }
  | { readonly ok: false; readonly codigo: "CSV_DEMASIADO_GRANDE" | "CSV_INVALIDO"; readonly errores: readonly ErrorLineaFondo[]; readonly totalErrores: number };

type Campo<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly codigo: CodigoLineaFondo };
const mal = (codigo: CodigoLineaFondo): Campo<never> => ({ ok: false, codigo });

function leerFecha(texto: string, hoy: Date): Campo<Date> {
  if (!FECHA.test(texto)) return mal("FECHA_FORMATO");
  const r = leerFechaIso(texto);
  if (!r.ok) return mal("FECHA_INVALIDA");
  return r.valor > hoy ? mal("FECHA_FUTURA") : r;
}

/** El texto solo vale si es exactamente lo que deja el lector de la SFC: así nada se redondea ni se reinterpreta. */
function leerValor(texto: string, forma: RegExp, canonico: (t: string) => string | null, codigos: readonly [CodigoLineaFondo, CodigoLineaFondo]): Campo<string> {
  if (!forma.test(texto)) return mal(codigos[0]);
  return canonico(texto) === texto ? { ok: true, valor: texto } : mal(codigos[1]);
}

const leerUnidad = (t: string) => leerValor(t, VALOR_UNIDAD, leerValorUnidad, ["VALOR_UNIDAD_FORMATO", "VALOR_UNIDAD_FUERA_DE_RANGO"]);
const leerFondo = (t: string): Campo<string | null> => (t === "" ? { ok: true, valor: null } : leerValor(t, VALOR_FONDO, leerValorFondo, ["VALOR_FONDO_FORMATO", "VALOR_FONDO_FUERA_DE_RANGO"]));

interface FilaFondo {
  readonly codigoFic: string;
  readonly participacion: string | null;
  readonly valor: ValorDia;
}

/** Una fila de datos (ya sabida ASCII y de largo válido): su fondo y su valor, o el primer campo que falla. */
function leerFila(linea: string, hoy: Date): Campo<FilaFondo> {
  const campos = linea.split(",");
  if (campos.length !== COLUMNAS) return mal("COLUMNAS");
  const [codigoFic, participacion, fechaTexto, unidadTexto, fondoTexto] = campos as [string, string, string, string, string];
  if (!CODIGO_FIC_RE.test(codigoFic)) return mal("CODIGO_FIC_FORMATO");
  if (participacion !== "" && !PARTICIPACION_RE.test(participacion)) return mal("PARTICIPACION_FORMATO");
  const fecha = leerFecha(fechaTexto, hoy);
  if (!fecha.ok) return fecha;
  const unidad = leerUnidad(unidadTexto);
  if (!unidad.ok) return unidad;
  const fondo = leerFondo(fondoTexto);
  if (!fondo.ok) return fondo;
  return { ok: true, valor: { codigoFic, participacion: participacion === "" ? null : participacion, valor: { fecha: fecha.valor, valorUnidad: unidad.valor, valorFondo: fondo.valor } } };
}

const esImprimible = (b: number): boolean => b >= IMPRIMIBLE_MIN && b <= IMPRIMIBLE_MAX;

interface Linea {
  readonly numero: number;
  readonly texto: string;
  /** El código de forma que ya la descarta (no ASCII, vacía o larga), o null. */
  readonly codigo: CodigoLineaFondo | null;
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
    const codigo = !trozo.every(esImprimible) ? "NO_ASCII" : trozo.length === 0 ? "LINEA_VACIA" : trozo.length > MAX_LARGO_LINEA_FONDO ? "LINEA_DEMASIADO_LARGA" : null;
    numero += 1;
    yield { numero, texto: codigo === null ? String.fromCharCode(...trozo) : "", codigo, sinLf: lf === -1 };
    inicio = fin + 1;
  }
}

/** Acumula errores: guarda los primeros MAX_ERRORES_LISTADOS y cuenta hasta MAX_ERRORES_CONTADOS (ahí se deja de leer). */
class Errores {
  readonly lista: ErrorLineaFondo[] = [];
  total = 0;
  agregar(linea: number, codigo: CodigoLineaFondo): void {
    this.total += 1;
    if (this.lista.length < MAX_ERRORES_LISTADOS) this.lista.push({ linea, codigo });
  }
  get colmado(): boolean {
    return this.total >= MAX_ERRORES_CONTADOS;
  }
}

interface Acumulado {
  readonly fondos: Map<string, { participacion: string | null; primeraLinea: number; valores: ValorDia[] }>;
  readonly vistas: Set<string>;
  filas: number;
}

/** Suma la fila a su fondo; el código si no se puede (forma, repetida, otra clase o un fondo de más). */
function agregarFila(texto: string, numero: number, acc: Acumulado, hoy: Date): CodigoLineaFondo | null {
  const fila = leerFila(texto, hoy);
  if (!fila.ok) return fila.codigo;
  const { codigoFic, participacion, valor } = fila.valor;
  const fondo = acc.fondos.get(codigoFic);
  if (fondo && fondo.participacion !== participacion) return "PARTICIPACION_DISTINTA";
  const clave = `${codigoFic}|${valor.fecha.getTime()}`;
  if (acc.vistas.has(clave)) return "FILA_REPETIDA";
  if (!fondo && acc.fondos.size >= MAX_FONDOS_CSV) return "DEMASIADOS_FONDOS";
  acc.vistas.add(clave);
  if (fondo) fondo.valores.push(valor);
  else acc.fondos.set(codigoFic, { participacion, primeraLinea: numero, valores: [valor] });
  return null;
}

/** Valida una fila de datos y la suma; false si ya no se debe seguir leyendo (tope de filas). */
function sumarFila(texto: string, numero: number, acc: Acumulado, errores: Errores, hoy: Date): boolean {
  if (acc.filas >= MAX_FILAS_CSV_FONDO) {
    errores.agregar(numero, "DEMASIADAS_FILAS");
    return false;
  }
  acc.filas += 1;
  const codigo = agregarFila(texto, numero, acc, hoy);
  if (codigo) errores.agregar(numero, codigo);
  return true;
}

function resultado(acc: Acumulado): LecturaCsvFondo {
  const fondos = [...acc.fondos].map(([codigoFic, f]) => ({
    codigoFic, participacion: f.participacion, primeraLinea: f.primeraLinea, valores: [...f.valores].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
  }));
  const desde = fondos.reduce((m, f) => Math.min(m, f.valores[0]!.fecha.getTime()), Number.POSITIVE_INFINITY);
  const hasta = fondos.reduce((m, f) => Math.max(m, f.valores.at(-1)!.fecha.getTime()), Number.NEGATIVE_INFINITY);
  return { ok: true, fondos, filas: acc.filas, desde: new Date(desde), hasta: new Date(hasta) };
}

const invalido = (errores: Errores): LecturaCsvFondo => ({ ok: false, codigo: "CSV_INVALIDO", errores: errores.lista, totalErrores: errores.total });

/** Lee y valida el CSV entero. Todo o nada. `hoy` es la fecha de negocio en Colombia (tope de las fechas). */
export function leerCsvValoresFondo(bytes: Uint8Array, hoy: Date): LecturaCsvFondo {
  if (bytes.length > MAX_BYTES_CSV_FONDO) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 };
  const errores = new Errores();
  if (bytes.length === 0) return (errores.agregar(1, "VACIO"), invalido(errores));
  const acc: Acumulado = { fondos: new Map(), vistas: new Set(), filas: 0 };
  let ultima = 0;
  for (const l of lineasDe(bytes)) {
    ultima = l.numero;
    if (l.codigo !== null) errores.agregar(l.numero, l.codigo);
    else if (l.numero === 1) {
      if (l.texto !== ENCABEZADO_CSV_FONDO) errores.agregar(l.numero, "ENCABEZADO");
    } else if (!sumarFila(l.texto, l.numero, acc, errores, hoy)) break;
    if (l.sinLf) errores.agregar(l.numero, "SIN_FIN_DE_LINEA");
    if (errores.colmado) break;
  }
  if (errores.total === 0 && acc.filas === 0) errores.agregar(ultima + 1, "SIN_FILAS");
  return errores.total > 0 ? invalido(errores) : resultado(acc);
}

export type EscrituraCsvFondo =
  | { readonly ok: true; readonly texto: string; readonly filas: number }
  | { readonly ok: false; readonly codigo: "SIN_FILAS" | "CSV_DEMASIADO_GRANDE" | "FILA_INVALIDA" };

export interface FondoAEscribir {
  readonly codigoFic: string;
  readonly participacion: string | null;
  readonly valores: readonly ValorDia[];
}

/**
 * Escribe el CSV de los fondos, en el orden dado. Antes de entregarlo lo vuelve a leer: nunca escribe un CSV que el
 * importador rechazaría (una fila inválida o un tope pasado se informan con su código).
 */
export function escribirCsvValoresFondo(fondos: readonly FondoAEscribir[], hoy: Date): EscrituraCsvFondo {
  const filas = fondos.flatMap((f) => f.valores.map((v) => `${f.codigoFic},${f.participacion ?? ""},${isoDia(v.fecha)},${v.valorUnidad},${v.valorFondo ?? ""}`));
  if (filas.length === 0) return { ok: false, codigo: "SIN_FILAS" };
  if (filas.length > MAX_FILAS_CSV_FONDO) return { ok: false, codigo: "CSV_DEMASIADO_GRANDE" };
  const texto = `${[ENCABEZADO_CSV_FONDO, ...filas].join("\n")}\n`;
  const comprobado = leerCsvValoresFondo(new TextEncoder().encode(texto), hoy);
  if (comprobado.ok) return { ok: true, texto, filas: filas.length };
  return { ok: false, codigo: comprobado.codigo === "CSV_DEMASIADO_GRANDE" ? "CSV_DEMASIADO_GRANDE" : "FILA_INVALIDA" };
}
