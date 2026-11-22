// Detector de lenguaje de consejo o de juicio para /operar (frente operar-informe): lo usan el candado de unidad
// (lenguaje.candado.test.ts) y el e2e (tests/e2e/operar.spec.ts). Puro, sin vitest ni Playwright. No es una prueba.
/**
 * Las expresiones prohibidas, ya sin tildes y en minúsculas (se comparan con el texto normalizado), por familia:
 * imperativos de usted y de tú, consejo, juicio sobre el momento y urgencia.
 */
export const PROHIBIDAS: readonly string[] = [
  // imperativos (usted): «comprar» y «vender» en infinitivo sí pasan, son la acción del plan
  "compre", "compren", "venda", "vendan", "adquiera", "adquieran", "liquide", "liquiden", "reduzca", "reduzcan", "aumente", "aumenten",
  "mantenga", "mantengan", "espere", "esperen", "invierta", "inviertan", "realice", "ejecute", "opere", "operen", "aproveche", "aprovechen",
  // imperativos (tú), solo en giros que no son un sustantivo («una compra»)
  "compra ya", "vende ya", "compra ahora", "vende ahora",
  // consejo
  "le recomendamos", "recomendamos", "le recomiendo", "recomendacion", "recomendaciones", "le sugerimos", "sugerimos", "le aconsejamos", "aconsejamos",
  "le conviene", "conviene", "convendria", "deberia", "deberian", "tendria que", "tiene que", "hay que", "lo mejor es", "lo ideal es",
  "es buena idea", "es mala idea",
  // juicio sobre el momento y urgencia
  "buen momento", "mal momento", "mejor momento", "momento ideal", "es hora de", "es el momento", "oportunidad", "oportunidades", "no pierda", "imperdible",
];

/**
 * Sin marcas diacríticas, en minúsculas y con los espacios juntos. El guion blando se quita (parte una palabra); los
 * demás caracteres de formato (ancho cero) y los guiones cuentan como espacio: «buen-momento» y «le\u200bconviene» muerden.
 */
const normalizar = (t: string): string =>
  t.replace(/\u00AD/g, "").replace(/[\p{Cf}\p{Pd}]/gu, " ").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
const PATRON = new RegExp(`(?<![\\p{L}\\p{N}])(${PROHIBIDAS.map((p) => p.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** Las expresiones prohibidas que aparecen en el texto, en orden y sin repetir. */
export function prohibidasEn(texto: string): string[] {
  return [...new Set([...normalizar(texto).matchAll(PATRON)].map((m) => m[1]!))];
}
