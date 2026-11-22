// Detector de lenguaje de consejo o de juicio para /operar (frente operar-informe): lo usan el candado de unidad
// (lenguaje.candado.test.ts) y el e2e (tests/e2e/operar.spec.ts). Puro, sin vitest ni Playwright. No es una prueba.
/** Las expresiones prohibidas, ya sin tildes y en minúsculas (se comparan con el texto normalizado). */
export const PROHIBIDAS: readonly string[] = [
  "compre", "compren", "venda", "vendan", "le recomendamos", "recomendamos", "le recomiendo", "recomendacion", "le sugerimos", "sugerimos",
  "le conviene", "conviene", "convendria", "deberia", "deberian", "buen momento", "mal momento", "oportunidad", "oportunidades", "aproveche",
  "es buena idea", "es mala idea", "le aconsejamos", "aconsejamos",
];

/** Sin marcas diacríticas, en minúsculas y con los espacios juntos. */
const normalizar = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ");
const PATRON = new RegExp(`(?<![\\p{L}\\p{N}])(${PROHIBIDAS.map((p) => p.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** Las expresiones prohibidas que aparecen en el texto, en orden y sin repetir. */
export function prohibidasEn(texto: string): string[] {
  return [...new Set([...normalizar(texto).matchAll(PATRON)].map((m) => m[1]!))];
}
