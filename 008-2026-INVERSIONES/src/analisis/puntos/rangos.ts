/**
 * Los rangos de cada punto y su importancia. Los límites inferiores importan las constantes del catálogo
 * (src/analisis/catalogo.ts); los demás son el punto de partida de la v1 y se ajustan viéndolos en la pantalla. Se
 * compara el valor pasado por `redondear`, como hace observaciones.ts. Puro.
 */
import { FACTOR_CONTRIBUCION_DESPROPORCIONADA, UMBRAL_PESO_PRIMERA, UMBRAL_REGLA_CERCANA_PCT } from "../catalogo";
import { redondear } from "../numeros";
import type { ClavePunto, Importancia, Rango } from "./tipos";

export { CLAVES_PUNTO, VERSION_PUNTOS } from "./tipos";

/** Peso por encima del cual el de la especie es muy elevado (fracción). */
export const UMBRAL_PESO_MUY_ELEVADO = 0.4;
/** HHI desde el cual la concentración es moderada y por encima del cual es elevada (4 especies iguales dan 0,25). */
export const UMBRAL_HHI_MODERADA = 0.15;
export const UMBRAL_HHI_ELEVADA = 0.25;
/** Contribución al riesgo sobre el peso (veces) desde la cual es muy mayor que el peso. */
export const FACTOR_CONTRIBUCION_MUY_ALTA = 2.5;
/** Efecto en el portafolio de una caída de la especie (fracción, en valor absoluto). */
export const EFECTO_CAIDA_NOTABLE = 0.05;
export const EFECTO_CAIDA_FUERTE = 0.1;
/** Probabilidad de quedar por debajo de lo aportado (fracción). */
export const PROBABILIDAD_MODERADA = 0.1;
export const PROBABILIDAD_ELEVADA = 0.25;
/** Distancia al nivel de la regla (por ciento): muy cerca, cerca y en rango (este último es UMBRAL_REGLA_CERCANA_PCT). */
export const DISTANCIA_MUY_CERCA_PCT = 1;
export const DISTANCIA_CERCA_PCT = 3;

export interface Tramo {
  readonly rango: Rango;
  /** El borde del tramo (en las distancias, el borde superior). */
  readonly limite: number;
  readonly importancia: Importancia;
  /** El borde no cuenta dentro del tramo (peso y HHI elevado: «más de»). */
  readonly estricto: boolean;
}

const t = (rango: Rango, limite: number, importancia: Importancia, estricto: boolean): Tramo => ({ rango, limite, importancia, estricto });

/** Cada clave con sus tramos de menor a mayor gravedad: el índice es el ordinal del rango. */
export const TRAMOS: Readonly<Record<ClavePunto, readonly Tramo[]>> = Object.freeze({
  PESO_ESPECIE: [t("ELEVADO", UMBRAL_PESO_PRIMERA, "MEDIA", true), t("MUY_ELEVADO", UMBRAL_PESO_MUY_ELEVADO, "ALTA", true)],
  PUNTO_CONCENTRACION: [t("MODERADA", UMBRAL_HHI_MODERADA, "MEDIA", false), t("ELEVADA", UMBRAL_HHI_ELEVADA, "MEDIA", true)],
  PUNTO_CONTRIBUCION_RIESGO: [
    t("DESPROPORCIONADA", FACTOR_CONTRIBUCION_DESPROPORCIONADA, "MEDIA", false),
    t("MUY_DESPROPORCIONADA", FACTOR_CONTRIBUCION_MUY_ALTA, "ALTA", false),
  ],
  PUNTO_EFECTO_CAIDA: [t("MEDIANO", EFECTO_CAIDA_NOTABLE, "BAJA", false), t("GRANDE", EFECTO_CAIDA_FUERTE, "MEDIA", false)],
  PROBABILIDAD_BAJO_APORTADO: [t("INTERMEDIA", PROBABILIDAD_MODERADA, "BAJA", false), t("ELEVADA", PROBABILIDAD_ELEVADA, "MEDIA", false)],
  REGLA_TOCADA: [t("TOCADA", 0, "ALTA", false)],
  REGLA_EN_EL_NIVEL: [t("EN_EL_NIVEL", 0, "ALTA", false)],
  REGLA_DISTANCIA: [
    t("EN_RANGO", UMBRAL_REGLA_CERCANA_PCT, "BAJA", false),
    t("CERCA", DISTANCIA_CERCA_PCT, "MEDIA", true),
    t("MUY_CERCA", DISTANCIA_MUY_CERCA_PCT, "ALTA", true),
  ],
});

/** El tramo que cumple el valor (el de mayor gravedad), o null si no llega al primero. */
export function rangoDe(clave: ClavePunto, medido: number): Tramo | null {
  const x = redondear(medido);
  const tramos = TRAMOS[clave];
  if (clave === "REGLA_DISTANCIA") {
    const d = Math.abs(x);
    // De mayor a menor cercanía: el primero que cumple es el más grave. Los bordes inferiores cuentan en el tramo de arriba.
    return [...tramos].reverse().find((tr) => (tr.estricto ? d < tr.limite : d <= tr.limite)) ?? null;
  }
  let hallado: Tramo | null = null;
  for (const tr of tramos) if (tr.estricto ? x > tr.limite : x >= tr.limite) hallado = tr;
  return hallado;
}

export function importanciaDe(clave: ClavePunto, rango: Rango): Importancia {
  const tr = TRAMOS[clave].find((x) => x.rango === rango);
  if (tr === undefined) throw new RangeError(`El rango ${rango} no es de ${clave}.`);
  return tr.importancia;
}

/** El orden del rango dentro de su clave (0 es el menos grave). */
export function ordinalDe(clave: ClavePunto, rango: Rango): number {
  return TRAMOS[clave].findIndex((x) => x.rango === rango);
}
