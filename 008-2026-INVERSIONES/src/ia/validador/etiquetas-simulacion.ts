/**
 * ETIQUETA.SIN_HECHO (solo SIMULACION): la frase de una etiqueta, o su núcleo, solo vale junto a una cita del hecho que lleva
 * esa etiqueta. «El peso de la especie … queda en …, muy elevado, al nivel de la regla» afirmaba algo que ningún hecho
 * respalda, con solo palabras de etiqueta. Se mira cada palabra DISTINTIVA de la etiqueta de un punto (la que está en la
 * etiqueta de esa clave y en ninguna otra del catálogo de SIMULACION, de más de tres letras: «nivel», «cercanía», «caída»,
 * «riesgo», «aportado»…): si aparece, el hecho al que se atribuye (el de la cita más cercana, como las marcas) tiene que ser
 * el de esa clave. Las palabras salen del catálogo, nunca a mano. Las de un rango («mayor que su peso») no cuentan: las
 * revisa RANGO_CONTRADICE. Va con el código ETIQUETA_NO_COINCIDE y el patrón ETIQUETA.SIN_HECHO.
 */
import { CATALOGO } from "../catalogo";
import type { HechosPorId } from "./hechos";
import { formaDe, plegarTildes, type TextoPreparado } from "./patron";
import type { Atribucion } from "./texto";

const MIN_LARGO = 4;
const palabrasDe = (texto: string): readonly string[] => plegarTildes(texto.toLowerCase()).match(/\p{L}+/gu) ?? [];

/** Cada palabra distintiva de la etiqueta de un punto de SIMULACION y la clave a la que pertenece. */
function derivar(): ReadonlyMap<string, string> {
  const entradas = Object.entries(CATALOGO.SIMULACION);
  const duenas = new Map<string, Set<string>>();
  for (const [clave, entrada] of entradas) for (const palabra of palabrasDe(entrada.etiqueta)) duenas.set(palabra, (duenas.get(palabra) ?? new Set<string>()).add(clave));
  const puntos = new Set(entradas.filter(([, e]) => e.rangos.length > 0).map(([clave]) => clave));
  const mapa = new Map<string, string>();
  for (const [palabra, claves] of duenas) {
    const [unica] = [...claves];
    if (claves.size === 1 && unica !== undefined && puntos.has(unica) && palabra.length >= MIN_LARGO) mapa.set(palabra, unica);
  }
  return mapa;
}

export const PALABRAS_DE_ETIQUETA: ReadonlyMap<string, string> = derivar();

/** Los hallazgos ETIQUETA.SIN_HECHO de una frase (un solo patrón, sin repetir). */
export function revisarEtiquetasSimulacion(preparado: TextoPreparado, atribucion: Atribucion, porId: HechosPorId, exenta: (posicion: number) => boolean): readonly string[] {
  for (const m of formaDe(preparado, "PLEGADO").matchAll(/\p{L}+/gu)) {
    const clave = PALABRAS_DE_ETIQUETA.get(m[0]);
    if (clave === undefined || exenta(m.index)) continue;
    if (!atribucion.destinosEn(m.index).some((id) => porId.get(id)?.clave === clave)) return Object.freeze(["ETIQUETA.SIN_HECHO"]);
  }
  return Object.freeze([]);
}
