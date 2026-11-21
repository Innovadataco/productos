/**
 * La lista de nemotécnicos que lee `precios:exportar`: la escribe el dueño a mano, en su carpeta privada (la Fábrica
 * nunca la lee). Pura. Un nemotécnico por línea (`[A-Z0-9]{2,20}`, como en el CSV de cierres); las líneas vacías y
 * las que empiezan por «#» se saltan; se tolera un CR al final de la línea y que la última no termine en LF.
 * Solo ASCII imprimible. A lo sumo MAX_NEMOS_LISTA (las especies que caben en el CSV). Errores con línea y código,
 * nunca el nemotécnico.
 */
import { MAX_ERRORES_LISTADOS, MAX_ESPECIES_CSV } from "./csv-cierres";

export const MAX_BYTES_LISTA = 4096;
export const MAX_NEMOS_LISTA = MAX_ESPECIES_CSV;
const NEMOTECNICO = /^[A-Z0-9]{2,20}$/;
const IMPRIMIBLE = /^[\x20-\x7e]*$/;

export type CodigoLista = "NO_ASCII" | "NEMOTECNICO_FORMATO" | "NEMO_REPETIDO" | "DEMASIADOS_NEMOS" | "SIN_NEMOS";

export interface NemoDeLista {
  readonly nemotecnico: string;
  readonly linea: number;
}

export type ResultadoLista =
  | { readonly ok: true; readonly nemos: readonly NemoDeLista[] }
  | { readonly ok: false; readonly errores: readonly { readonly linea: number; readonly codigo: CodigoLista }[]; readonly totalErrores: number };

/** El código que descarta la línea, o null si es un nemotécnico válido y nuevo. */
function codigoDe(texto: string, vistos: ReadonlySet<string>, cuantos: number): CodigoLista | null {
  if (!IMPRIMIBLE.test(texto)) return "NO_ASCII";
  if (!NEMOTECNICO.test(texto)) return "NEMOTECNICO_FORMATO";
  if (vistos.has(texto)) return "NEMO_REPETIDO";
  return cuantos >= MAX_NEMOS_LISTA ? "DEMASIADOS_NEMOS" : null;
}

export function leerListaNemos(bytes: Uint8Array): ResultadoLista {
  const lineas = Buffer.from(bytes).toString("latin1").split("\n");
  const nemos: NemoDeLista[] = [];
  const vistos = new Set<string>();
  const errores: { linea: number; codigo: CodigoLista }[] = [];
  let totalErrores = 0;
  for (const [i, cruda] of lineas.entries()) {
    const texto = cruda.endsWith("\r") ? cruda.slice(0, -1) : cruda;
    if (texto === "" || texto.startsWith("#")) continue;
    const codigo = codigoDe(texto, vistos, nemos.length);
    if (codigo === null) {
      vistos.add(texto);
      nemos.push({ nemotecnico: texto, linea: i + 1 });
      continue;
    }
    totalErrores += 1;
    if (errores.length < MAX_ERRORES_LISTADOS) errores.push({ linea: i + 1, codigo });
  }
  if (totalErrores === 0 && nemos.length === 0) return { ok: false, errores: [{ linea: 1, codigo: "SIN_NEMOS" }], totalErrores: 1 };
  return totalErrores > 0 ? { ok: false, errores, totalErrores } : { ok: true, nemos };
}
