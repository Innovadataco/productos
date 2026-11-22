/**
 * El CSV de decretos que escribe el dueño (fase C, C4a): el contrato del archivo. Puro; todo o nada.
 *   especie,tipo,fecha_anuncio,cuota,valor_por_accion,moneda,forma,fecha_ex,fecha_pago,referencia,anulada,nota
 * - Una fila por cuota, tal como la publica la fuente oficial (reglas de cada columna en filas.ts).
 * - El archivo es el libro del dueño: cada fila dice el estado que él quiere para su clave (especie, fecha_anuncio,
 *   tipo, cuota). Una fila igual a lo registrado no escribe; distinta, es la versión siguiente; anular es la misma fila
 *   con anulada=SI y una nota. Borrar una fila del archivo NO anula nada.
 * - Dos filas con la misma clave → DECRETO_REPETIDO (en la segunda). Después de resolver las especies se revisa otra
 *   vez por instrumento (src/datos-oficiales/decretos/importar.ts): un alias de Trii y su nemotécnico son la misma.
 * - Topes: MAX_BYTES_DECRETOS y MAX_FILAS_DECRETOS (las de datos, sin el encabezado).
 */
import type { Crudo } from "../../cifrado/campos";
import { diaIso } from "../../precios/horario";
import { leerArchivoRegistro } from "../registro/archivo";
import type { Hallazgo } from "../registro/hallazgos";
import { COLUMNAS, interpretarFila, type DecretoLeido } from "./filas";

export const ENCABEZADO_DECRETOS: readonly string[] = COLUMNAS;
export const MAX_BYTES_DECRETOS = 1024 * 1024;
export const MAX_FILAS_DECRETOS = 2000;

export interface FilaDecreto {
  readonly decreto: DecretoLeido;
  /** La fila tal cual vino: se guarda cifrada en fila_fuente (#11). */
  readonly crudo: Crudo;
}

export type LecturaDecretos =
  | { readonly ok: true; readonly sha256: string; readonly filas: readonly FilaDecreto[] }
  | { readonly ok: false; readonly sha256: string; readonly hallazgos: readonly Hallazgo[] };

/** La clave de un decreto por el texto de su especie (antes de resolverla). */
export const claveTexto = (d: Pick<DecretoLeido, "especie" | "tipo" | "fechaAnuncio" | "cuota">): string =>
  `${d.especie}|${d.tipo}|${diaIso(d.fechaAnuncio)}|${d.cuota}`;

/** `hoy`: la fecha de negocio en Bogotá (un anuncio posterior se rechaza). */
export function leerCsvDecretos(bytes: Uint8Array, hoy: Date): LecturaDecretos {
  const archivo = leerArchivoRegistro(bytes, { encabezado: ENCABEZADO_DECRETOS, maxBytes: MAX_BYTES_DECRETOS, maxFilas: MAX_FILAS_DECRETOS });
  if (!archivo.ok) return archivo;
  const hallazgos: Hallazgo[] = [];
  const filas: FilaDecreto[] = [];
  const vistas = new Set<string>();
  for (const f of archivo.filas) {
    const r = interpretarFila(f.celdas, f.numero, hoy);
    if (!r.ok) {
      hallazgos.push(...r.hallazgos);
      continue;
    }
    const clave = claveTexto(r.decreto);
    if (vistas.has(clave)) hallazgos.push({ linea: f.numero, columna: null, codigo: "DECRETO_REPETIDO" });
    vistas.add(clave);
    filas.push({ decreto: r.decreto, crudo: f.crudo });
  }
  return hallazgos.length > 0 ? { ok: false, sha256: archivo.sha256, hallazgos } : { ok: true, sha256: archivo.sha256, filas };
}
