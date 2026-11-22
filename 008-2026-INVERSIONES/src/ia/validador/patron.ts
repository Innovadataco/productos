/**
 * Patrones de texto del validador. Cada patrón tiene un id estable («CATEGORIA.NOMBRE», sin dígitos), sus alternativas
 * (palabras o frases, o fragmentos de regex) y la forma del texto sobre la que corre:
 * - MINUSCULAS: NFC, sin caracteres de formato invisibles, espacios unidos y en minúsculas (las tildes cuentan: «bajó» no
 *   es «bajo»);
 * - PLEGADO: lo mismo, sin las tildes del español (á é í ó ú ü; la ñ se queda), para atrapar «deberia» y «debería».
 * Las dos formas tienen el mismo largo y las mismas posiciones: las marcas se atribuyen por posición a la cita más cercana.
 *
 * La expresión la arma `construirExpresion` (y se puede volver a armar sin una alternativa: el candado por mutación lo
 * hace): la bandera `u`, sin `g` ni `y` (no guarda estado), las palabras completas con `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])`
 * (en JS, `\b` es ASCII aunque lleve `u`) y, entre las palabras de una frase, uno o más espacios o signos « , ; : ( ) « » »
 * («va, a subir» es «va a subir»).
 */
import type { Cercania, Direccion, Frescura } from "../contrato";

export type FormaDelTexto = "PLEGADO" | "MINUSCULAS";

export interface Patron {
  readonly id: string;
  readonly sobre: FormaDelTexto;
  readonly alternativas: readonly string[];
  /** Un fragmento de regex que va antes de las alternativas (p. ej. una mirada atrás «(?<!sin )»), o vacío. */
  readonly antes: string;
  readonly patron: RegExp;
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
/** Lo que puede ir entre dos palabras de una frase de un patrón. */
const SEPARADOR = "[ ,;:()«»]+";

/** Sin las tildes del español (á é í ó ú ü; la ñ se queda): un carácter por otro, mismas posiciones. */
export const plegarTildes = (texto: string): string =>
  texto.replace(/á/gu, "a").replace(/é/gu, "e").replace(/í/gu, "i").replace(/ó/gu, "o").replace(/[úü]/gu, "u");

/** Las dos formas del texto (ver arriba). */
export function prepararTexto(texto: string): TextoPreparado {
  const minusculas = texto.normalize("NFC").replace(INVISIBLES, "").replace(ESPACIOS, " ").toLowerCase();
  return Object.freeze({ minusculas, plegado: plegarTildes(minusculas) });
}

export const formaDe = (preparado: TextoPreparado, sobre: FormaDelTexto): string => (sobre === "PLEGADO" ? preparado.plegado : preparado.minusculas);

/** La expresión de las alternativas, como palabras completas. Sin alternativas es un defecto del código: RangeError. */
export function construirExpresion(alternativas: readonly string[], antes: string): RegExp {
  if (alternativas.length === 0) throw new RangeError("Un patrón necesita al menos una alternativa.");
  const cuerpo = alternativas.map((a) => a.replace(/ /gu, SEPARADOR)).join("|");
  return new RegExp(`(?<![\\p{L}\\p{N}])${antes}(?:${cuerpo})(?![\\p{L}\\p{N}])`, "u");
}

export const patron = (id: string, sobre: FormaDelTexto, alternativas: readonly string[], antes = ""): Patron =>
  Object.freeze({ id, sobre, alternativas: Object.freeze([...alternativas]), antes, patron: construirExpresion(alternativas, antes) });

export const patronMarca = (id: string, sobre: FormaDelTexto, alternativas: readonly string[], marca: MarcaDelHecho): PatronMarca =>
  Object.freeze({ ...patron(id, sobre, alternativas), marca: Object.freeze({ ...marca }) });

/** Los ids de los patrones que aparecen en el texto ya preparado, en el orden de la lista. */
export function coincidenciasEn(preparado: TextoPreparado, patrones: readonly Patron[]): readonly string[] {
  return Object.freeze(patrones.filter((p) => p.patron.test(formaDe(preparado, p.sobre))).map((p) => p.id));
}

/** Los ids de los patrones que aparecen en el texto, en el orden de la lista. */
export const coincidencias = (texto: string, patrones: readonly Patron[]): readonly string[] => coincidenciasEn(prepararTexto(texto), patrones);

/** Una copia global de cada expresión, hecha una vez: `matchAll` la clona, así que no comparte estado. */
const GLOBALES = new WeakMap<Patron, RegExp>();

/** Dónde empieza cada aparición del patrón en su forma del texto. */
export function posiciones(preparado: TextoPreparado, p: Patron): readonly number[] {
  const global = GLOBALES.get(p) ?? new RegExp(p.patron.source, `${p.patron.flags}g`);
  GLOBALES.set(p, global);
  return [...formaDe(preparado, p.sobre).matchAll(global)].map((m) => m.index);
}
