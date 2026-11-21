/**
 * La lista de fondos que lee `fondo:exportar`: privada (dice qué fondo tiene el dueño); la escribe el dueño en su
 * carpeta privada o, con orden del CEO, la Fábrica en una carpeta 700 que borra al terminar. Pura.
 * - Una línea por fondo: `<codigo>` o `<codigo>,<participacion>` (el `codigo_negocio` y la clase `tipo_participacion`
 *   de la SFC, como los registra `registrar-fondo`). Sin espacios. Sin clase se pide sin filtrar, como
 *   `actualizar-fondo` con un fondo sin clase registrada.
 * - Las líneas vacías y las que empiezan por «#» se saltan; se tolera un CR al final y que la última no termine en LF.
 * - Solo ASCII imprimible. Un código no se repite (tampoco con otra clase). A lo sumo MAX_FONDOS_LISTA.
 * Errores con línea y código, nunca el código del fondo.
 */
import { MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS } from "../precios/csv-cierres";
import { MAX_FONDOS_CSV } from "./csv-valores";
import { CODIGO_FIC_RE, PARTICIPACION_RE } from "./sfc";

export const MAX_BYTES_LISTA_FONDOS = 4096;
export const MAX_FONDOS_LISTA = MAX_FONDOS_CSV;
const IMPRIMIBLE = /^[\x20-\x7e]*$/;

export type CodigoListaFondos = "NO_ASCII" | "FONDO_FORMATO" | "FONDO_REPETIDO" | "DEMASIADOS_FONDOS" | "SIN_FONDOS";

export interface FondoDeLista {
  readonly codigo: string;
  readonly participacion: string | null;
  readonly linea: number;
}

export type ResultadoListaFondos =
  | { readonly ok: true; readonly fondos: readonly FondoDeLista[] }
  | { readonly ok: false; readonly errores: readonly { readonly linea: number; readonly codigo: CodigoListaFondos }[]; readonly totalErrores: number };

/** `codigo` o `codigo,participacion`, o null si la forma no sirve. */
function partes(texto: string): { codigo: string; participacion: string | null } | null {
  const campos = texto.split(",");
  if (campos.length > 2 || !CODIGO_FIC_RE.test(campos[0]!)) return null;
  if (campos.length === 1) return { codigo: campos[0]!, participacion: null };
  return PARTICIPACION_RE.test(campos[1]!) ? { codigo: campos[0]!, participacion: campos[1]! } : null;
}

type Lectura = { readonly fondo: { codigo: string; participacion: string | null } } | { readonly codigo: CodigoListaFondos };

function leerLinea(texto: string, vistos: ReadonlySet<string>, cuantos: number): Lectura {
  if (!IMPRIMIBLE.test(texto)) return { codigo: "NO_ASCII" };
  const fondo = partes(texto);
  if (!fondo) return { codigo: "FONDO_FORMATO" };
  if (vistos.has(fondo.codigo)) return { codigo: "FONDO_REPETIDO" };
  return cuantos >= MAX_FONDOS_LISTA ? { codigo: "DEMASIADOS_FONDOS" } : { fondo };
}

export function leerListaFondos(bytes: Uint8Array): ResultadoListaFondos {
  const lineas = Buffer.from(bytes).toString("latin1").split("\n");
  const fondos: FondoDeLista[] = [];
  const vistos = new Set<string>();
  const errores: { linea: number; codigo: CodigoListaFondos }[] = [];
  let totalErrores = 0;
  for (const [i, cruda] of lineas.entries()) {
    const texto = cruda.endsWith("\r") ? cruda.slice(0, -1) : cruda;
    if (texto === "" || texto.startsWith("#")) continue;
    const r = leerLinea(texto, vistos, fondos.length);
    if ("fondo" in r) {
      vistos.add(r.fondo.codigo);
      fondos.push({ ...r.fondo, linea: i + 1 });
      continue;
    }
    totalErrores += 1;
    if (errores.length < MAX_ERRORES_LISTADOS) errores.push({ linea: i + 1, codigo: r.codigo });
    if (totalErrores >= MAX_ERRORES_CONTADOS) break;
  }
  if (totalErrores === 0 && fondos.length === 0) return { ok: false, errores: [{ linea: 1, codigo: "SIN_FONDOS" }], totalErrores: 1 };
  return totalErrores > 0 ? { ok: false, errores, totalErrores } : { ok: true, fondos };
}
