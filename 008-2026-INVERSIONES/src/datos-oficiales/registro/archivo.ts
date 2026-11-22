/**
 * Lectura del CSV que escribe el dueño para el registro (fase C: decretos, C4a): todo o nada, antes de abrir la base.
 * Recibe los bytes (el script los lee con src/lib/archivo-acotado.ts): src/ no toca el disco. Puro.
 * - Tope de bytes antes de decodificar; UTF-8 estricto (con o sin BOM); RFC 4180 con el lector de Trii
 *   (src/importacion/trii/csv.ts: comillas, comillas escapadas y líneas vacías omitidas que cuentan en la numeración).
 * - Encabezado EXACTO y en su orden: una columna de más, de menos, en otro orden o con espacios rechaza el archivo.
 * - Cada fila con tantas celdas como el encabezado, y ninguna celda con caracteres de control, de formato (invisibles,
 *   de dirección de texto, etiquetas), separadores de línea o de párrafo, ni los rellenos invisibles que no son de
 *   formato (tampoco un salto dentro de comillas: ningún dato del registro lo necesita). La nota se mostrará en C6b.
 * - Tope de filas de datos.
 * Los hallazgos llevan línea, columna y código, nunca el valor. El sha256 es el de los bytes recibidos.
 */
import { createHash } from "node:crypto";
import { ErrorCsv, leerCsv, type RegistroCsv } from "../../importacion/trii/csv";
import { enTodoElArchivo, type Hallazgo } from "./hallazgos";

export interface ReglasArchivo {
  readonly encabezado: readonly string[];
  readonly maxBytes: number;
  readonly maxFilas: number;
}

export interface FilaArchivo {
  readonly numero: number;
  readonly celdas: readonly string[];
  /** La fila tal cual vino (encabezado → celda): se guarda cifrada (#11). */
  readonly crudo: Readonly<Record<string, string>>;
}

export type LecturaArchivo =
  | { readonly ok: true; readonly sha256: string; readonly filas: readonly FilaArchivo[] }
  | { readonly ok: false; readonly sha256: string; readonly hallazgos: readonly Hallazgo[] };

/**
 * Controles (Cc: C0 con el tabulador y los saltos, DEL, C1), de formato (Cf: guion blando, marcas de dirección, ancho
 * cero, BOM, anclas, etiquetas), separadores de línea y de párrafo (Zl, Zp), y los invisibles que Unicode no marca como
 * formato: el grafema combinante U+034F, los rellenos hangul y los selectores de variación.
 */
export const NO_PERMITIDO = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u034f\u115f\u1160\u3164\uffa0\ufe00-\ufe0f]/u;

/** UTF-8 estricto; el BOM inicial lo quita el decodificador. */
function decodificar(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function registros(texto: string): RegistroCsv[] | null {
  try {
    return leerCsv(texto);
  } catch (e) {
    if (e instanceof ErrorCsv) return null;
    throw e;
  }
}

const mismoEncabezado = (celdas: readonly string[], esperado: readonly string[]): boolean =>
  celdas.length === esperado.length && celdas.every((c, i) => c === esperado[i]);

function revisarFila(r: RegistroCsv, encabezado: readonly string[]): Hallazgo[] {
  if (r.celdas.length !== encabezado.length) return [{ linea: r.numero, columna: null, codigo: "COLUMNAS_DISTINTAS" }];
  return r.celdas.flatMap((c, i) => (NO_PERMITIDO.test(c) ? [{ linea: r.numero, columna: encabezado[i]!, codigo: "CARACTER_NO_PERMITIDO" }] : []));
}

export function leerArchivoRegistro(bytes: Uint8Array, reglas: ReglasArchivo): LecturaArchivo {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const rechazo = (hallazgos: readonly Hallazgo[]): LecturaArchivo => ({ ok: false, sha256, hallazgos });
  if (bytes.byteLength > reglas.maxBytes) return rechazo([enTodoElArchivo("ARCHIVO_DEMASIADO_GRANDE")]);
  const texto = decodificar(bytes);
  if (texto === null) return rechazo([enTodoElArchivo("CODIFICACION_NO_UTF8")]);
  const leidos = registros(texto);
  if (leidos === null) return rechazo([enTodoElArchivo("COMILLA_SIN_CERRAR")]);
  const [encabezado, ...datos] = leidos;
  if (!encabezado || !mismoEncabezado(encabezado.celdas, reglas.encabezado)) {
    return rechazo([{ linea: encabezado?.numero ?? 1, columna: null, codigo: "ENCABEZADO_DISTINTO" }]);
  }
  if (datos.length === 0) return rechazo([enTodoElArchivo("ARCHIVO_SIN_FILAS")]);
  if (datos.length > reglas.maxFilas) return rechazo([enTodoElArchivo("DEMASIADAS_FILAS")]);
  const hallazgos = datos.flatMap((r) => revisarFila(r, reglas.encabezado));
  if (hallazgos.length > 0) return rechazo(hallazgos);
  const filas = datos.map((r) => ({
    numero: r.numero,
    celdas: r.celdas,
    crudo: Object.fromEntries(reglas.encabezado.map((columna, i) => [columna, r.celdas[i]!])),
  }));
  return { ok: true, sha256, filas };
}
