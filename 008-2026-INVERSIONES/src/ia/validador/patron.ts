/**
 * Patrones de texto del validador. Cada patrón tiene un id estable («CATEGORIA.NOMBRE», sin dígitos), una expresión
 * con la bandera `u` y sin `g` ni `y` (no guarda estado entre usos) y la forma del texto sobre la que corre:
 * - MINUSCULAS: NFC, sin caracteres de formato invisibles, espacios unidos y en minúsculas (las tildes cuentan: «bajó» no
 *   es «bajo»);
 * - PLEGADO: lo mismo, sin las tildes del español (á é í ó ú ü; la ñ se queda), para atrapar «deberia» y «debería».
 * Las dos formas tienen el mismo largo y las mismas posiciones: las marcas se atribuyen por posición a la cita más cercana.
 * Las palabras se delimitan con `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` (en JS, `\b` es ASCII aunque lleve `u`).
 */
import type { Cercania, Direccion, Frescura } from "../contrato";

export type FormaDelTexto = "PLEGADO" | "MINUSCULAS";

export interface Patron {
  readonly id: string;
  readonly patron: RegExp;
  readonly sobre: FormaDelTexto;
}

/** La marca del hecho que afirma una palabra: su dirección, su cercanía o que el dato es de hoy. */
export type MarcaDelHecho =
  | { readonly campo: "direccion"; readonly valor: Exclude<Direccion, "NO_APLICA"> }
  | { readonly campo: "cercania"; readonly valor: Exclude<Cercania, "NO_APLICA"> }
  | { readonly campo: "frescura"; readonly valor: Extract<Frescura, "HOY"> };

export interface PatronMarca extends Patron {
  readonly marca: MarcaDelHecho;
}

export interface TextoPreparado {
  readonly minusculas: string;
  readonly plegado: string;
}

const INVISIBLES = /\p{Cf}/gu;
const ESPACIOS = /\s+/gu;

/** Sin las tildes del español (á é í ó ú ü; la ñ se queda): un carácter por otro, mismas posiciones. */
export const plegarTildes = (texto: string): string =>
  texto.replace(/á/gu, "a").replace(/é/gu, "e").replace(/í/gu, "i").replace(/ó/gu, "o").replace(/[úü]/gu, "u");

/** Las dos formas del texto (ver arriba). */
export function prepararTexto(texto: string): TextoPreparado {
  const minusculas = texto.normalize("NFC").replace(INVISIBLES, "").replace(ESPACIOS, " ").toLowerCase();
  return Object.freeze({ minusculas, plegado: plegarTildes(minusculas) });
}

export const formaDe = (preparado: TextoPreparado, sobre: FormaDelTexto): string => (sobre === "PLEGADO" ? preparado.plegado : preparado.minusculas);

/** Las palabras o frases dadas, completas (sin letras ni dígitos pegados). Las alternativas son fragmentos de regex. */
export const palabras = (...alternativas: readonly string[]): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternativas.join("|")})(?![\\p{L}\\p{N}])`, "u");

export const patron = (id: string, sobre: FormaDelTexto, expresion: RegExp): Patron => Object.freeze({ id, patron: expresion, sobre });

export const patronMarca = (id: string, sobre: FormaDelTexto, expresion: RegExp, marca: MarcaDelHecho): PatronMarca =>
  Object.freeze({ id, patron: expresion, sobre, marca: Object.freeze({ ...marca }) });

/** Los ids de los patrones que aparecen en el texto ya preparado, en el orden de la lista. */
export function coincidenciasEn(preparado: TextoPreparado, patrones: readonly Patron[]): readonly string[] {
  return Object.freeze(patrones.filter((p) => p.patron.test(formaDe(preparado, p.sobre))).map((p) => p.id));
}

/** Los ids de los patrones que aparecen en el texto, en el orden de la lista. */
export const coincidencias = (texto: string, patrones: readonly Patron[]): readonly string[] => coincidenciasEn(prepararTexto(texto), patrones);

/** Dónde empieza cada aparición del patrón en su forma del texto (con una copia global local: el patrón no cambia). */
export function posiciones(preparado: TextoPreparado, p: Patron): readonly number[] {
  const global = new RegExp(p.patron.source, `${p.patron.flags}g`);
  return [...formaDe(preparado, p.sobre).matchAll(global)].map((m) => m.index);
}
