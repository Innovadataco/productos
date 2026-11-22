/**
 * El CSV de los rendimientos del fondo que escribe el dueño (frente fondo-rendimientos): el contrato del archivo. Puro;
 * todo o nada (lo lee src/datos-oficiales/registro/archivo.ts: tope, UTF-8 estricto, encabezado exacto, sin caracteres
 * de control ni invisibles).
 *   fecha,tipo,valor
 * - Una fila por operación del encargo del FIC, tal como la muestra el portal del comisionista: `RENDIMIENTO` es el
 *   «PAGO DE RDTOS» (lo que entra a la caja) y `RETENCION`, la «RTE/FTE» (la retención en la fuente sobre ese pago, que
 *   ya llega neto: no mueve la caja).
 * - fecha AAAA-MM-DD, no posterior a hoy en Bogotá; tipo exacto, sin tilde; valor con punto decimal, sin signo, miles
 *   ni exponente, hasta 4 decimales y mayor que 0 (se guarda canónico, sin ceros de sobra).
 * - Dos filas con la misma fecha y tipo → FILA_REPETIDA (en la segunda): la base guarda un hecho por (fondo, fecha,
 *   tipo) y una fila de más, una vez escrita, no se puede borrar.
 * - Topes: MAX_BYTES_RENDIMIENTOS y MAX_FILAS_RENDIMIENTOS (las de datos, sin el encabezado).
 * Los hallazgos llevan línea, columna y código, nunca el valor (son datos del dueño).
 */
import type { Crudo } from "../../cifrado/campos";
import { leerArchivoRegistro } from "../../datos-oficiales/registro/archivo";
import type { Hallazgo } from "../../datos-oficiales/registro/hallazgos";
import { ESCALA_MONTO, leerDecimal, leerFechaIso, type ResultadoValor } from "../../importacion/trii/valores";
import { diaIso } from "../../precios/horario";

export const ENCABEZADO_RENDIMIENTOS: readonly string[] = ["fecha", "tipo", "valor"];
export const MAX_BYTES_RENDIMIENTOS = 256 * 1024;
export const MAX_FILAS_RENDIMIENTOS = 2000;

export type TipoRendimiento = "RENDIMIENTO" | "RETENCION";
const TIPOS: readonly TipoRendimiento[] = ["RENDIMIENTO", "RETENCION"];

export interface FilaRendimiento {
  /** Número del registro en el archivo (el encabezado es el 1). */
  readonly linea: number;
  readonly fecha: Date;
  readonly tipo: TipoRendimiento;
  /** Texto decimal canónico, > 0, para Prisma.Decimal sin pasar por punto flotante. */
  readonly valor: string;
  /** La fila tal cual vino: se guarda cifrada en fila_fuente (#11). */
  readonly crudo: Crudo;
}

export type LecturaRendimientos =
  | { readonly ok: true; readonly sha256: string; readonly filas: readonly FilaRendimiento[] }
  | { readonly ok: false; readonly sha256: string; readonly hallazgos: readonly Hallazgo[] };

/** La clave de una fila dentro del archivo (el fondo es uno solo por carga). */
export const claveFila = (f: Pick<FilaRendimiento, "fecha" | "tipo">): string => `${diaIso(f.fecha)}|${f.tipo}`;

function leerFecha(texto: string, hoy: Date): ResultadoValor<Date> {
  const r = leerFechaIso(texto);
  if (!r.ok) return r;
  return r.valor.getTime() > hoy.getTime() ? { ok: false, codigo: "FECHA_FUTURA" } : r;
}

function leerTipo(texto: string): ResultadoValor<TipoRendimiento> {
  const tipo = TIPOS.find((t) => t === texto);
  return tipo ? { ok: true, valor: tipo } : { ok: false, codigo: "TIPO_DESCONOCIDO" };
}

function leerValor(texto: string): ResultadoValor<string> {
  const r = leerDecimal(texto, ESCALA_MONTO);
  if (!r.ok) return r;
  return r.valor.startsWith("-") || r.valor === "0" ? { ok: false, codigo: "VALOR_NO_POSITIVO" } : r;
}

type LecturaFila = { readonly ok: true; readonly fila: FilaRendimiento } | { readonly ok: false; readonly hallazgos: readonly Hallazgo[] };

function interpretarFila(celdas: readonly string[], linea: number, crudo: Crudo, hoy: Date): LecturaFila {
  const [fechaTxt = "", tipoTxt = "", valorTxt = ""] = celdas;
  const hallazgos: Hallazgo[] = [];
  const tomar = <T>(columna: string, r: ResultadoValor<T>): T | undefined => {
    if (r.ok) return r.valor;
    hallazgos.push({ linea, columna, codigo: r.codigo });
    return undefined;
  };
  const fecha = tomar("fecha", leerFecha(fechaTxt, hoy));
  const tipo = tomar("tipo", leerTipo(tipoTxt));
  const valor = tomar("valor", leerValor(valorTxt));
  if (fecha === undefined || tipo === undefined || valor === undefined) return { ok: false, hallazgos };
  return { ok: true, fila: { linea, fecha, tipo, valor, crudo } };
}

/** `hoy`: la fecha de negocio en Bogotá (medianoche UTC): una fila posterior se rechaza. */
export function leerCsvRendimientos(bytes: Uint8Array, hoy: Date): LecturaRendimientos {
  const archivo = leerArchivoRegistro(bytes, { encabezado: ENCABEZADO_RENDIMIENTOS, maxBytes: MAX_BYTES_RENDIMIENTOS, maxFilas: MAX_FILAS_RENDIMIENTOS });
  if (!archivo.ok) return archivo;
  const hallazgos: Hallazgo[] = [];
  const filas: FilaRendimiento[] = [];
  const vistas = new Set<string>();
  for (const f of archivo.filas) {
    const r = interpretarFila(f.celdas, f.numero, f.crudo, hoy);
    if (!r.ok) {
      hallazgos.push(...r.hallazgos);
      continue;
    }
    const clave = claveFila(r.fila);
    if (vistas.has(clave)) hallazgos.push({ linea: f.numero, columna: null, codigo: "FILA_REPETIDA" });
    vistas.add(clave);
    filas.push(r.fila);
  }
  return hallazgos.length > 0 ? { ok: false, sha256: archivo.sha256, hallazgos } : { ok: true, sha256: archivo.sha256, filas };
}
