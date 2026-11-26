/**
 * «Para revisar» en el simulador: los cambios de rango de los puntos como ítems de texto para la pantalla (sin cálculo en
 * el cliente). Cada ítem lleva la importancia EN TEXTO, la frase del código y una nota «antes · después · umbral» con las
 * cifras en español. Sin valorar la operación. Puro.
 */
import { TRAMOS } from "@/analisis/puntos/rangos";
import { fraseDelCambio } from "@/analisis/puntos/etiquetas";
import type { ClavePunto, Importancia, LadoDelCambio, PuntoCambio } from "@/analisis/puntos/tipos";
import { hhiEs, pctEs, porcentajeEs } from "./texto";

export interface ItemRevisar {
  /** La importancia del cambio, para la pantalla (nunca se deriva del texto). */
  readonly nivel: Importancia;
  /** «Importancia alta», «Importancia media» o «Importancia baja». */
  readonly importancia: string;
  readonly frase: string;
  readonly nota: string;
}

const ROTULO: Readonly<Record<Importancia, string>> = { ALTA: "Importancia alta", MEDIA: "Importancia media", BAJA: "Importancia baja" };
const SIN_PUNTO_ANTES = "no aplicaba";
const SIN_PUNTO_DESPUES = "ya no aplica";
const NOTA_REGLA = "Medida con el precio límite de la orden frente al nivel de la regla";
const vecesEs = (x: number): string => `${porcentajeEs(x.toFixed(2))} veces`;

function cifra(clave: ClavePunto, x: number): string {
  switch (clave) {
    case "PUNTO_CONCENTRACION":
      return hhiEs(x);
    case "PUNTO_CONTRIBUCION_RIESGO":
      return vecesEs(x);
    case "REGLA_DISTANCIA":
      return pctEs(x / 100);
    default:
      return pctEs(x);
  }
}

function umbral(c: PuntoCambio): string {
  const lado = (c.despues ?? c.antes)!;
  const tramo = TRAMOS[c.clave].find((t) => t.rango === lado.rango)!;
  const n = cifra(c.clave, tramo.limite);
  if (c.clave === "REGLA_DISTANCIA") return `${tramo.estricto ? "menos de" : "hasta"} ${n}`;
  return `${tramo.estricto ? "más de" : "desde"} ${n}`;
}

const medido = (clave: ClavePunto, l: LadoDelCambio | null, sinPunto: string): string => (l === null ? sinPunto : cifra(clave, l.medido));

function nota(c: PuntoCambio): string {
  if (c.clave === "REGLA_TOCADA" || c.clave === "REGLA_EN_EL_NIVEL") return NOTA_REGLA;
  return `Antes ${medido(c.clave, c.antes, SIN_PUNTO_ANTES)} · después ${medido(c.clave, c.despues, SIN_PUNTO_DESPUES)} · umbral ${umbral(c)}`;
}

/** En el orden recibido (ya viene ordenado de `compararPuntos`). */
export function itemsParaRevisar(cambios: readonly PuntoCambio[], nombres: ReadonlyMap<string, string>): readonly ItemRevisar[] {
  return cambios.map((c) => ({ nivel: c.importancia, importancia: ROTULO[c.importancia], frase: fraseDelCambio(c, nombres), nota: nota(c) }));
}
