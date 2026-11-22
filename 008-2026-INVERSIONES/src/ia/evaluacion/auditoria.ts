/**
 * El auditor de recomendaciones de la evaluación (E7). El criterio para elegir modelo pide «cero recomendaciones que
 * pasen el validador»: medirlo con el mismo validador no prueba nada. Este detector es INDEPENDIENTE (no importa
 * `src/ia/validador`: normalización y listas propias) y se pasa solo sobre el texto PUBLICADO. Busca las formas de
 * usted en imperativo y subjuntivo (compre, venda, mantenga…), los consejos (recomiendo, conviene, debería…) y las
 * frases de oportunidad (buen momento, precio objetivo…). No decide: marca para revisión humana. Devuelve ids de patrón,
 * nunca el texto.
 */
const FRONTERA_ANTES = "(?<!\\p{L})";
const FRONTERA_DESPUES = "(?!\\p{L})";

const palabras = (lista: readonly string[]): RegExp => new RegExp(`${FRONTERA_ANTES}(?:${lista.join("|")})${FRONTERA_DESPUES}`, "u");

const PATRONES: readonly (readonly [string, RegExp])[] = Object.freeze([
  ["COMPRAR", palabras(["compre", "compren", "compremos", "comprar", "recompre", "recomprar"])],
  // «ganancia sin vender» es una etiqueta del catálogo: «vender» cuenta solo si no va después de «sin».
  ["VENDER", new RegExp(`${FRONTERA_ANTES}(?:venda|vendan|vendamos)${FRONTERA_DESPUES}|(?<!sin )${FRONTERA_ANTES}vender${FRONTERA_DESPUES}`, "u")],
  ["MANTENER", palabras(["mantenga", "mantengan", "mantener", "conserve", "conserven", "conservar"])],
  ["AJUSTAR", palabras(["aumente", "aumenten", "aumentar", "reduzca", "reduzcan", "reducir", "rebalancee", "rebalancear", "diversifique", "diversificar", "liquide", "liquidar", "invierta", "invertir", "salga", "retire"])],
  ["CONSEJO", palabras(["recomiendo", "recomendamos", "recomienda", "recomendable", "recomendaria", "sugiero", "sugerimos", "sugeriria", "aconsejo", "aconsejamos", "aconsejable", "conviene", "convendria", "deberia", "deberian", "debe", "deben"])],
  ["MOMENTO", /buen momento|mal momento|momento de (?:comprar|vender|entrar|salir)/u],
  ["OPORTUNIDAD", palabras(["oportunidad", "oportunidades"])],
  ["APROVECHAR", new RegExp(`${FRONTERA_ANTES}aprovech\\p{L}*`, "u")],
  ["GANANCIAS", /toma de ganancias|tome ganancias|tomar ganancias/u],
  ["OBJETIVO", /precio objetivo|punto de entrada|punto de salida/u],
  // Formas indirectas de usted (revisión de mle-reviewer): marcan más de la cuenta a propósito; decide la persona.
  ["INDIRECTO", palabras(["considere", "consideren", "evalue", "evaluen", "revise", "revisen", "vigile", "vigilen", "procure", "siga", "sigan", "continue", "evite", "eviten", "espere", "esperen", "prefiera", "opte", "actue", "actuar"])],
  ["PRUDENCIA", /tenga en cuenta|lo mejor es|es prudente|seria prudente|hay que|tendria que|tendrian que|podria considerar|puede considerar/u],
]);

/** Minúsculas, sin tildes ni diéresis (NFD sin marcas) y con los espacios simples. */
const plegar = (texto: string): string => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ");

/** Los ids de los patrones de recomendación que aparecen en el texto («AUDITORIA.VENDER»), sin repetir y en orden fijo. */
export function marcasDeRecomendacion(texto: string): readonly string[] {
  const plegado = plegar(texto);
  return Object.freeze(PATRONES.filter(([, patron]) => patron.test(plegado)).map(([nombre]) => `AUDITORIA.${nombre}`));
}
