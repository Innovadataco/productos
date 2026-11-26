/**
 * RANGO_CONTRADICE (solo SIMULACION): las palabras de rango («muy elevado», «moderada», «mediano», «mucho mayor que su
 * peso», «cerca de su nivel»…, las de `ETIQUETA_RANGO` del paso 1, con su otro género) solo valen junto a un hecho que tenga
 * ESE rango. Se atribuyen a la cita más cercana que no sea un nombre (`atribuir`, como las marcas) y se cotejan contra el
 * `rango` del hecho en el PAQUETE: si ninguno de sus destinos lo tiene, o no hay ninguno, contradice. La palabra «grande» o
 * «elevado» fuera de un rango también cuenta (el validador falla cerrado).
 * Las palabras de un rango no se leen como marcas de cercanía («cerca» de «muy cerca de su nivel»): `exenta`.
 */
import { ETIQUETA_RANGO } from "../../analisis/puntos/etiquetas";
import type { Hecho } from "../contrato";
import type { HechosPorId } from "./hechos";
import { formaDe, plegarTildes, type TextoPreparado } from "./patron";
import type { Atribucion } from "./texto";

const SEPARADORES = /[ ,;:()«»]+/gu;
/** El otro género de la última palabra de un rango adjetival. */
const OTRO_GENERO: Readonly<Record<string, string>> = {
  elevado: "elevada", elevada: "elevado", moderada: "moderado", moderado: "moderada", mediano: "mediana", mediana: "mediano",
  intermedia: "intermedio", intermedio: "intermedia", tocada: "tocado", tocado: "tocada",
};

const plegar = (frase: string): string => plegarTildes(frase.toLowerCase());

/** Cada frase de rango (sin tildes, con sus dos géneros) con los códigos de rango que la admiten. */
function construirFrases(): ReadonlyMap<string, ReadonlySet<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const porRango of Object.values(ETIQUETA_RANGO)) {
    for (const [rango, frase] of Object.entries(porRango as Record<string, string>)) {
      const palabras = plegar(frase).split(" ");
      const ultima = palabras[palabras.length - 1] as string;
      const variantes = [palabras.join(" "), ...(OTRO_GENERO[ultima] === undefined ? [] : [[...palabras.slice(0, -1), OTRO_GENERO[ultima]].join(" ")])];
      for (const v of variantes) mapa.set(v, (mapa.get(v) ?? new Set<string>()).add(rango));
    }
  }
  return mapa;
}

export const FRASES_DE_RANGO: ReadonlyMap<string, ReadonlySet<string>> = construirFrases();

/** Las más largas primero: «muy elevado» antes que «elevado», para que no se cuenten dos veces. */
const EXPRESION = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...FRASES_DE_RANGO.keys()].sort((a, b) => b.length - a.length).map((f) => f.replace(/ /gu, "[ ,;:()«»]+")).join("|")})(?![\\p{L}\\p{N}])`,
  "gu",
);

export interface AparicionDeRango {
  readonly inicio: number;
  readonly fin: number;
  readonly rangos: ReadonlySet<string>;
}

/** Las frases de rango del texto, sin solaparse, con su lugar (en la forma plegada, las mismas posiciones que la preparada). */
export function apariciones(preparado: TextoPreparado): readonly AparicionDeRango[] {
  const texto = formaDe(preparado, "PLEGADO");
  return [...texto.matchAll(EXPRESION)].map((m) => ({
    inicio: m.index,
    fin: m.index + m[0].length,
    rangos: FRASES_DE_RANGO.get(m[0].replace(SEPARADORES, " ")) as ReadonlySet<string>,
  }));
}

/** Los hallazgos de RANGO_CONTRADICE de una frase: un patrón por clase, sin repetir. */
export function revisarRangos(preparado: TextoPreparado, atribucion: Atribucion, porId: HechosPorId): readonly string[] {
  const patrones = new Set<string>();
  for (const a of apariciones(preparado)) {
    const destinos = atribucion.destinosEn(a.inicio);
    if (destinos.length === 0) patrones.add("RANGO_CONTRADICE.SIN_HECHO");
    else if (!destinos.some((id) => { const r = (porId.get(id) as Hecho).rango; return r !== undefined && a.rangos.has(r); })) patrones.add("RANGO_CONTRADICE.PALABRA");
  }
  return Object.freeze([...patrones]);
}
