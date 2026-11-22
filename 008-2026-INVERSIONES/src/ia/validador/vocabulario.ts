/**
 * Vocabulario cerrado del validador (IDIOMA.VOCABULARIO). Las listas negras de recomendación, predicción, trato y cifras
 * nunca quedan completas: cada revisión encuentra sinónimos nuevos («tome posición», «se perfila», «trepó»). Por eso
 * el texto del modelo solo puede usar:
 * - las palabras de las etiquetas del catálogo de los tres tipos (con su plural y su singular);
 * - las palabras de las marcas que se cotejan contra el paquete (subió, bajó, se mantuvo, cerca, lejos, hoy…);
 * - `PALABRAS_BASE`: palabras funcionales (artículos, preposiciones, conectores, el trato de usted) y verbos neutros
 *   («es», «quedó», «quedaría», «suma», «faltan»), ninguno de los cuales dispara un patrón prohibido.
 * Una palabra de fuera rechaza la frase (cierra en fallo). Ampliar el vocabulario es otra versión del validador, con la
 * evidencia de la evaluación E7.
 */
import { CATALOGO } from "../catalogo";
import { TIPOS_RESUMEN } from "../contrato";
import { plegarTildes, prepararTexto } from "./patron";
import { PATRONES_MARCA } from "./patrones-lengua";

/** En minúsculas y sin tildes (la ñ se queda). */
export const PALABRAS_BASE: readonly string[] = Object.freeze([
  // artículos y determinantes
  "el", "la", "los", "las", "lo", "un", "una", "unos", "unas", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas", "su", "sus",
  "cada", "otro", "otra", "otros", "otras", "todo", "toda", "todos", "todas",
  // preposiciones
  "a", "al", "ante", "con", "contra", "de", "del", "desde", "en", "entre", "hacia", "hasta", "para", "por", "segun", "sin", "sobre", "tras",
  "frente",
  // conectores y adverbios neutros
  "y", "e", "o", "u", "pero", "aunque", "mientras", "que", "como", "cuando", "donde", "sino", "tambien", "ademas", "asimismo", "aun",
  "todavia", "respectivamente", "cual", "cuales", "no",
  // el trato de usted
  "usted", "ustedes", "le", "les", "se",
  // verbos neutros
  "es", "son", "fue", "fueron", "era", "eran", "estan", "estaba", "estaban", "estuvo", "estuvieron", "ha", "han", "hay", "habia", "sido",
  "queda", "quedan", "quedo", "quedaron", "quedaria", "quedarian", "seria", "serian", "tiene", "tienen", "tenia", "tenian", "tuvo",
  "tuvieron", "tendria", "tendrian", "suma", "suman", "sumo", "sumaron", "sumaria", "sumarian", "registra", "registran", "registro",
  "registraron", "marca", "marcan", "marco", "alcanza", "alcanzan", "alcanzo", "alcanzaron", "alcanzaria", "alcanzarian", "llega",
  "llegan", "llego", "llegaron", "llegaria", "llegarian", "corresponde", "corresponden", "equivale", "equivalen", "representa",
  "representan", "indica", "indican", "muestra", "muestran", "cuenta", "cuentan", "falta", "faltan", "vence", "vencen", "paga", "pagan",
  "pago", "pagaron", "recibio", "recibieron", "toco", "tocaron", "cerro", "cerraron", "cierra", "cierran", "vale", "valen",
  // sustantivos del dominio que no están en las etiquetas
  "dato", "datos", "cifra", "cifras",
]);

const plegar = (palabra: string): string => plegarTildes(palabra.toLowerCase());

/** La palabra con su singular, su otro género («atrasado», «atrasadas») y sus plurales probables (las de más no estorban). */
function conVariantes(palabra: string): readonly string[] {
  const singulares = [palabra, ...(palabra.endsWith("es") ? [palabra.slice(0, -2), palabra.slice(0, -1)] : palabra.endsWith("s") ? [palabra.slice(0, -1)] : [])];
  const generos = singulares.flatMap((w) => (w.endsWith("o") ? [w, `${w.slice(0, -1)}a`] : w.endsWith("a") ? [w, `${w.slice(0, -1)}o`] : [w]));
  return generos.flatMap((w) => [w, `${w}s`, `${w}es`]);
}

const palabrasDe = (texto: string): readonly string[] => texto.match(/\p{L}+/gu) ?? [];
const LITERAL = /^[\p{L} ]+$/u;

const VOCABULARIO: ReadonlySet<string> = new Set([
  ...PALABRAS_BASE,
  ...TIPOS_RESUMEN.flatMap((tipo) => Object.values(CATALOGO[tipo]).flatMap((e) => palabrasDe(e.etiqueta).map(plegar).flatMap(conVariantes))),
  ...PATRONES_MARCA.flatMap((p) => p.alternativas.filter((a) => LITERAL.test(a)).flatMap(palabrasDe).map(plegar)),
]);

/** Las palabras del texto (sin las citas) que no están en el vocabulario, sin repetir, en orden de aparición. */
export function palabrasFueraDelVocabulario(texto: string): readonly string[] {
  const plegado = prepararTexto(texto).plegado.replace(/\{h[0-9]{2}\}/gu, " ");
  return Object.freeze([...new Set(palabrasDe(plegado).filter((p) => !VOCABULARIO.has(p)))]);
}
