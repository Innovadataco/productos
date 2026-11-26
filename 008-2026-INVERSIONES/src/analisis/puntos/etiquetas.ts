/**
 * Las frases de los cambios de puntos, armadas por el código con una plantilla: dicen qué cambió de rango, sin valorar la operación
 * ni indicar qué hacer. El punto de una regla se mide con el precio límite de la orden, y la frase lo dice. Las cifras las pone
 * quien muestra (src/operar/analisis/revisar.ts). Puro.
 */
import type { ClavePunto, PuntoCambio, Rango } from "./tipos";

const OTRA = "otra especie";

/** La palabra de cada rango, en el género de su sujeto (el peso, la concentración, la contribución...). */
export const ETIQUETA_RANGO: Readonly<Record<ClavePunto, Readonly<Partial<Record<Rango, string>>>>> = {
  PESO_ESPECIE: { ELEVADO: "elevado", MUY_ELEVADO: "muy elevado" },
  PUNTO_CONCENTRACION: { MODERADA: "moderada", ELEVADA: "elevada" },
  PUNTO_CONTRIBUCION_RIESGO: { DESPROPORCIONADA: "mayor que su peso", MUY_DESPROPORCIONADA: "mucho mayor que su peso" },
  PUNTO_EFECTO_CAIDA: { MEDIANO: "mediano", GRANDE: "grande" },
  PROBABILIDAD_BAJO_APORTADO: { INTERMEDIA: "intermedia", ELEVADA: "elevada" },
  REGLA_TOCADA: { TOCADA: "tocada" },
  REGLA_EN_EL_NIVEL: { EN_EL_NIVEL: "en su nivel" },
  REGLA_DISTANCIA: { MUY_CERCA: "muy cerca de su nivel", CERCA: "cerca de su nivel", EN_RANGO: "a poca distancia de su nivel" },
};

/** Entre « »: sin las comillas del propio nombre, que romperían la etiqueta. */
const entreComillas = (nombre: string): string => `«${nombre.replace(/[«»]/g, "")}»`;

function nombreDe(c: PuntoCambio, nombres: ReadonlyMap<string, string>): string {
  const id = c.sujeto.tipo === "PORTAFOLIO" ? null : c.sujeto.instrumentoId;
  return entreComillas((id === null ? undefined : nombres.get(id)) ?? OTRA);
}

function sujetoDe(c: PuntoCambio, nombres: ReadonlyMap<string, string>): string {
  const n = nombreDe(c, nombres);
  switch (c.clave) {
    case "PESO_ESPECIE":
      return `El peso de ${n}`;
    case "PUNTO_CONCENTRACION":
      return "La concentración del portafolio (HHI)";
    case "PUNTO_CONTRIBUCION_RIESGO":
      return `La contribución de ${n} al riesgo`;
    case "PUNTO_EFECTO_CAIDA":
      return `El efecto de una caída de ${n} en el portafolio`;
    case "PROBABILIDAD_BAJO_APORTADO":
      return "La probabilidad de quedar por debajo de lo aportado";
    default:
      return `Con el precio límite de la orden, la regla de ${n}`;
  }
}

const palabra = (clave: ClavePunto, lado: PuntoCambio["antes"]): string => (lado === null ? "" : (ETIQUETA_RANGO[clave][lado.rango] ?? ""));

export function fraseDelCambio(c: PuntoCambio, nombres: ReadonlyMap<string, string>): string {
  const sujeto = sujetoDe(c, nombres);
  const antes = palabra(c.clave, c.antes);
  const despues = palabra(c.clave, c.despues);
  const regla = c.clave.startsWith("REGLA_");
  switch (c.cambio) {
    case "APARECE":
      return regla ? `${sujeto} queda ${despues}` : `${sujeto} pasa a ser ${despues}`;
    case "DESAPARECE":
      return regla ? `${sujeto} deja de quedar ${antes}` : `${sujeto} deja de ser ${antes}`;
    default:
      return `${sujeto} pasa de ${antes} a ${despues}`;
  }
}
