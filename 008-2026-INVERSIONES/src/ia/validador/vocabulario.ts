/**
 * Vocabulario cerrado del validador (IDIOMA.VOCABULARIO). Las listas negras de recomendación, predicción, trato y cifras
 * nunca quedan completas: cada revisión encuentra sinónimos nuevos («tome posición», «se perfila», «trepó»). Por eso
 * el texto del modelo solo puede usar, según el tipo del paquete:
 * - las palabras de las etiquetas del catálogo DE ESE TIPO (con su plural, su singular y su género): «alto» o «riesgo»
 *   son de ESCENARIOS y no valen en DIARIO;
 * - las marcas que se cotejan contra el paquete (subió, bajó, se mantuvo, a la baja, cerca, lejos, hoy…), solo como
 *   marca entera: se quitan del texto antes de mirar el vocabulario, y sus palabras sueltas («baja», «mismo») no valen;
 * - `PALABRAS_BASE`: palabras funcionales (artículos, preposiciones, conectores, el trato de usted) y verbos neutros
 *   («es», «quedó», «suma», «faltan»), ninguno de los cuales dispara un patrón prohibido;
 * - `CONDICIONALES` («quedaría», «sería»…), solo en ESCENARIOS: en DIARIO y REGLAS el condicional es un pronóstico.
 * Una palabra de fuera rechaza la frase (cierra en fallo). Ampliar el vocabulario es otra versión del validador, con la
 * evidencia de la evaluación E7.
 */
import { ETIQUETA_RANGO } from "../../analisis/puntos/etiquetas";
import { CATALOGO } from "../catalogo";
import { TIPOS_RESUMEN, type TipoResumen } from "../contrato";
import { formaDe, plegarTildes, prepararTexto } from "./patron";
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
  "queda", "quedan", "quedo", "quedaron", "tiene", "tienen", "tenia", "tenian", "tuvo", "tuvieron", "suma", "suman", "sumo", "sumaron",
  "registra", "registran", "registro", "registraron", "marca", "marcan", "marco", "alcanza", "alcanzan", "alcanzo", "alcanzaron", "llega",
  "llegan", "llego", "llegaron", "corresponde", "corresponden", "equivale", "equivalen", "representa",
  "representan", "indica", "indican", "muestra", "muestran", "cuenta", "cuentan", "falta", "faltan", "vence", "vencen", "paga", "pagan",
  "pago", "pagaron", "recibio", "recibieron", "toco", "tocaron", "cerro", "cerraron", "cierra", "cierran", "vale", "valen",
  // sustantivos del dominio que no están en las etiquetas
  "dato", "datos", "cifra", "cifras",
]);

/**
 * Los verbos neutros de PALABRAS_BASE (formas conjugadas): los ítems de «Para revisar» son nominales y no admiten ninguno
 * (PARA_REVISAR.VERBO). Todos están en PALABRAS_BASE: lo cuida `tests/unit/ia/simulacion/validador-v4.test.ts`.
 */
export const VERBOS_NEUTROS: readonly string[] = Object.freeze([
  "es", "son", "fue", "fueron", "era", "eran", "estan", "estaba", "estaban", "estuvo", "estuvieron", "ha", "han", "hay", "habia", "sido",
  "queda", "quedan", "quedo", "quedaron", "tiene", "tienen", "tenia", "tenian", "tuvo", "tuvieron", "suma", "suman", "sumo", "sumaron",
  "registra", "registran", "registro", "registraron", "marca", "marcan", "marco", "alcanza", "alcanzan", "alcanzo", "alcanzaron", "llega",
  "llegan", "llego", "llegaron", "corresponde", "corresponden", "equivale", "equivalen", "representa", "representan", "indica", "indican",
  "muestra", "muestran", "cuenta", "cuentan", "falta", "faltan", "vence", "vencen", "paga", "pagan", "pago", "pagaron", "recibio", "recibieron",
  "toco", "tocaron", "cerro", "cerraron", "cierra", "cierran", "vale", "valen",
]);

/** El condicional: solo en ESCENARIOS, donde describe un escenario y no pronostica. */
export const CONDICIONALES: readonly string[] = Object.freeze([
  "quedaria", "quedarian", "seria", "serian", "tendria", "tendrian", "sumaria", "sumarian", "alcanzaria", "alcanzarian", "llegaria", "llegarian",
]);

/**
 * El vocabulario de SIMULACION es una LISTA PERMITIDA EXPLÍCITA, escrita palabra por palabra: lo mínimo para describir el estado
 * del «después» en tercera persona. NO hereda PALABRAS_BASE: esa lista funcionaba como lista negra y cada palabra permitida con
 * sentido de acción abría una evasión («Sin la especie…», «Tras el registro…», «Cuando falta…», «no queda en», «todavía»).
 * Sin negaciones (no, ni, nunca, sin, tampoco), sin continuidad ni tiempo (todavía, aún, también, ya, antes, ahora, sigue), sin
 * conectores causales, temporales ni condicionales (si, cuando, tras, mientras, aunque, porque, pues, para, con, según, ante),
 * sin agente (usted, se, le, les) y sin verbos de acción ni de registro (registr…, falt…, sum…). A esto se suman las palabras de
 * las etiquetas de SIMULACION y las de los rangos del paso 1 (algunas son conectores, como «al» y «por», pero solas no atribuyen
 * nada: ATRIBUCION las vigila). Candado: `candados/vocabulario-sin-operacion.candado.test.ts` y la huella de
 * `simulacion/vocabulario-simulacion.test.ts`: ampliarla es otra versión del validador.
 */
export const PALABRAS_SIMULACION: readonly string[] = Object.freeze([
  "el", "la", "los", "las", "de", "del", "en", "y", "su", "sus", "queda", "quedan", "es", "son", "esta", "estan",
]);

const plegar = (palabra: string): string => plegarTildes(palabra.toLowerCase());

/** La palabra con su singular, su otro género («atrasado», «atrasadas») y sus plurales probables (las de más no estorban). */
function conVariantes(palabra: string): readonly string[] {
  const singulares = [palabra, ...(palabra.endsWith("es") ? [palabra.slice(0, -2), palabra.slice(0, -1)] : palabra.endsWith("s") ? [palabra.slice(0, -1)] : [])];
  const generos = singulares.flatMap((w) => (w.endsWith("o") ? [w, `${w.slice(0, -1)}a`] : w.endsWith("a") ? [w, `${w.slice(0, -1)}o`] : [w]));
  return generos.flatMap((w) => [w, `${w}s`, `${w}es`]);
}

const palabrasDe = (texto: string): readonly string[] => texto.match(/\p{L}+/gu) ?? [];

/** Las palabras de los rangos del paso 1 («muy elevado», «moderada», «mediano»…): solo SIMULACION las describe. */
const PALABRAS_DE_RANGO: readonly string[] = Object.values(ETIQUETA_RANGO).flatMap((porRango) => Object.values(porRango) as string[]).flatMap((p) => palabrasDe(p).map(plegar).flatMap(conVariantes));

/** Las palabras base del tipo: SIMULACION tiene su lista explícita y no hereda PALABRAS_BASE. */
const baseDe = (tipo: TipoResumen): readonly string[] => (tipo === "SIMULACION" ? PALABRAS_SIMULACION : PALABRAS_BASE);

const VOCABULARIO: ReadonlyMap<TipoResumen, ReadonlySet<string>> = new Map(TIPOS_RESUMEN.map((tipo) => [tipo, new Set([
  ...baseDe(tipo),
  ...(tipo === "ESCENARIOS" ? CONDICIONALES : []),
  ...(tipo === "SIMULACION" ? PALABRAS_DE_RANGO : []),
  ...Object.values(CATALOGO[tipo]).flatMap((e) => palabrasDe(e.etiqueta).map(plegar).flatMap(conVariantes)),
])]));

/** El vocabulario cerrado del tipo (palabras en minúsculas y sin tildes). */
export function vocabularioDe(tipo: TipoResumen): ReadonlySet<string> {
  return VOCABULARIO.get(tipo) as ReadonlySet<string>;
}

/** Las marcas enteras fuera del texto (con espacios del mismo largo): sus palabras ya las coteja `marcas.ts`. */
function sinMarcas(minusculas: string): string {
  return PATRONES_MARCA.reduce((texto, p) => texto.replace(new RegExp(p.patron.source, `${p.patron.flags}g`), (m) => " ".repeat(m.length)), minusculas);
}

/** Las palabras del texto (sin las citas ni las marcas) que no están en el vocabulario del tipo, sin repetir, en orden. */
export function palabrasFueraDelVocabulario(texto: string, tipo: TipoResumen): readonly string[] {
  // El tipo sale de un paquete construido (o de las pruebas): siempre es uno de TIPOS_RESUMEN.
  const vocabulario = VOCABULARIO.get(tipo) as ReadonlySet<string>;
  const restante = plegarTildes(sinMarcas(formaDe(prepararTexto(texto), "MINUSCULAS"))).replace(/\{h[0-9]{2}\}/gu, " ");
  return Object.freeze([...new Set(palabrasDe(restante).filter((p) => !vocabulario.has(p)))]);
}
