/**
 * Patrones de CAUSA: el texto no puede atribuir un hecho a una causa («subió por la tasa», «ante el mercado», «desde el
 * cierre», «debido a…»). 008 describe lo que pasó con los datos del paquete; el porqué no está en el paquete.
 * - CAUSA.POR: «por», salvo «por debajo de lo aportado», «ganancia(s) por ventas» y «decretado por acción».
 * - CAUSA.DESDE: «desde», salvo «vigente desde» seguido de una cita (la regla del plan vigente desde {Hnn}) o del fin del
 *   texto (la etiqueta sola, sin objeto): «vigente desde el cierre» sí es una causa.
 * - CAUSA.CON: «con», salvo «especies con cierre atrasado» y «valor con riesgo modelado» (etiquetas del catálogo).
 * - CAUSA.SIN: «sin» (el contrafactual «sin X, …»), salvo las etiquetas «ganancia sin vender», «especies sin precio»,
 *   «rentabilidad sin vender» y «regla sin cierre al día».
 * - CAUSA.CONECTOR: los conectores y locuciones de causa («porque», «es que», «a falta de», «debido a», «según», «ante», «tras», «como»…).
 * - CAUSA.CONECTOR incluye también la familia nominal «falta de(l)» («la falta de dividendos bajó…»): «faltan» y «falta» sueltos
 *   (etiquetas del catálogo) no son causa.
 * - CAUSA.TRANSITIVO: un verbo de marca de dirección del vocabulario («subió», «aumentó», «disminuyó», «mantuvo», «ha bajado»,
 *   «bajando», «perdió»… y sus plurales; no «superó» ni «rebasó», que tocan «superó el nivel de la regla»), con un adverbio
 *   opcional («también», «además»…) y un determinante («el», «su», «un», «ese», «otro», «todo», «cada»…) ante una palabra:
 *   «la tasa subió la ganancia total» hace que un hecho mueva a otro. Lo intransitivo («subió a {H01}») no entra, ni «subió un {H20}»
 *   (el determinante ante una cita). Corre sobre el texto plegado y SIN «bajo» ni exención de «escenario»: «el escenario subió el
 *   valor» rechaza. En ESCENARIOS (hechos con dirección) el verbo pegado a «escenario» es una causa real («… del escenario subió el
 *   escenario alto…»); la exención de 3a la dejaba pasar.
 * - CAUSA.TRANSITIVO_BAJO: «bajó» y «bajo» aparte, porque el texto plegado los iguala. Corre sobre MINUSCULAS, donde la tilde cuenta:
 *   «bajó» con tilde es el verbo siempre (también tras «escenario»: «del escenario bajó el escenario bajo» rechaza); «bajo» sin tilde
 *   rechaza salvo tras «escenario(s)» (`(?<!escenarios? )`: «En el escenario bajo el valor quedaría…» publica, es el adjetivo).
 *   La exención es solo para «bajo» exacto: «bájo» (tilde de más) rechaza también tras «escenario(s)» («del escenario bájo el escenario central»).
 *   Con «bajo» preposición («bajo el nivel de la regla», «bajo lo aportado») dispara y cae del lado seguro.
 *   Cada vocal del verbo, del adverbio y del determinante acepta su tilde de más («bájo la», «bajó ésta», «bajó él», «bajó tambíen la»):
 *   el vocabulario compara plegado, así que esas formas pasan por palabras de la base y deben rechazar (H10).
 *   ABIERTO (BAJO): sin determinante no dispara aquí: «bajó a {H}» SÍ es marca (DIRECCION.BAJA_VERBO) y la ataja ella; «bájo a {H}» no es marca ni causativo
 *   (parte de N3, tildes en las marcas de dirección, MEDIO aparte).
 *   ABIERTOS (BAJO): H9, «del escenario bajo el escenario bajo» con «bajo» sin tilde usado como verbo (indistinguible del adjetivo de
 *   H5); sin determinante («bajó ganancia total»), con una cita o una coma en medio, con «a» personal, verbos de la
 *   base («marcó», «registró», «tuvo», «cerró», «sumó a», «alcanzó», «tocó»), «falta en», «falta + y», las locuciones «a cuenta de»,
 *   «en el marco de», «a cambio de», «lo cual», «que» causal y «al/en/a pago de».
 * «cuando» y los verbos de atribución de la base («corresponde», «equivale», «representa», «indica», «muestra») no están
 * aquí: ya no son palabras del vocabulario (`vocabulario.ts`) y los rechaza IDIOMA.VOCABULARIO. «pero» sí vale: es de
 * contraste, no de causa. «para» queda abierto: sale de etiquetas y es de riesgo bajo.
 * Casi todos corren sobre el texto plegado (sin tildes); solo CAUSA.TRANSITIVO_BAJO corre sobre MINUSCULAS y por eso acepta cada tilde de más. Cada fragmento va con sus espacios literales: `patron()` los cambia por el
 * separador de frase (espacios y signos), también dentro de las miradas. Son listas negras: lo que no esté aquí lo ataja
 * el vocabulario cerrado. Cambiar una lista es otra versión del validador, con su huella nueva.
 */
import { patron, type Patron } from "./patron";

const FIN = "(?![\\p{L}\\p{N}])";
/**
 * Los verbos de marca de dirección del vocabulario (`PATRONES_MARCA`, plegados), menos «bajó» y «bajo» (los cubre CAUSA.TRANSITIVO_BAJO), y menos «superó» y «rebasó»
 * (y sus plurales), que tocan la frase propia «superó el nivel de la regla». Con un objeto detrás, un hecho mueve a otro.
 * Una prueba ata esta lista a las marcas: cada verbo de una palabra de ellas dispara. Los espacios van literales.
 */
const VERBOS_DE_MARCA =
  "(?:subio|subieron|sube|suben|subiendo|ha\\u0020subido|han\\u0020subido|aumento|aumentaron|aumenta|aumentan|crecio|crecieron|crece|crecen|" +
  "avanzo|avanzaron|avanza|avanzan|gano|ganaron|repunto|repuntaron|mejoro|mejoraron|mejora|mejoran|incremento|incrementaron|ascendio|" +
  "ascendieron|asciende|escalo|escalaron|salto|saltaron|elevo|elevaron|bajaron|baja|bajan|bajando|ha\\u0020bajado|han\\u0020bajado|" +
  "cayo|cayeron|cae|caen|cayendo|descendio|descendieron|desciende|disminuyo|disminuyeron|disminuye|retrocedio|retrocedieron|retrocede|" +
  "perdio|perdieron|pierde|pierden|empeoro|empeora|empeoran|redujo|redujeron|cedio|cedieron|mantuvo|mantuvieron|mantiene|mantienen|" +
  "movio|empujo|llevo|dejo)";
/** Un espacio literal (no el separador de frase): «subió, la ganancia total es…» no es un causativo; la coma corta. */
const UN_ESPACIO = "\\u0020";
/** Un adverbio opcional entre el verbo y el determinante («bajó también la ganancia total»). */
const ADVERBIO = `(?:(?:tambien|ademas|asimismo|aun|todavia)${UN_ESPACIO})?`;
const DETERMINANTES =
  "(?:el|la|los|las|lo|su|sus|un|una|unos|unas|este|esta|estos|estas|ese|esa|esos|esas|otro|otra|otros|otras|todo|toda|todos|todas|cada)";
/** El determinante va ante una palabra: «subió un {H20}» (una cifra con «un») no es causativo. */
const ANTE_PALABRA = `(?=${UN_ESPACIO}\\p{L})`;
/** «En el escenario bajo el valor quedaría…»: «bajo» sin tilde tras «escenario(s)» es el adjetivo del escenario, no el verbo. */
const NO_ESCENARIO = `(?<!escenarios?${UN_ESPACIO})`;
/**
 * El vocabulario compara plegado (sin tildes): «ésta», «él» o «tambíen» pasan por «esta», «el» o «tambien». Este patrón corre sobre
 * MINUSCULAS (la tilde cuenta, para distinguir «bajó» de «bajo»), así que cada vocal del verbo, del adverbio y del determinante
 * acepta su tilde (y la diéresis de la «u»): `tolerante` cambia cada vocal de una palabra por su clase.
 */
const CLASE_DE_VOCAL: Readonly<Record<string, string>> = { a: "[aá]", e: "[eé]", i: "[ií]", o: "[oó]", u: "[uúü]" };
const tolerante = (palabras: readonly string[]): string =>
  palabras.map((palabra) => palabra.replace(/[aeiou]/gu, (vocal) => CLASE_DE_VOCAL[vocal] as string)).join("|");
const ADVERBIO_TOLERANTE = `(?:(?:${tolerante(["tambien", "ademas", "asimismo", "aun", "todavia"])})${UN_ESPACIO})?`;
const DETERMINANTES_TOLERANTES = `(?:${tolerante([
  "el", "la", "los", "las", "lo", "su", "sus", "un", "una", "unos", "unas", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
  "otro", "otra", "otros", "otras", "todo", "toda", "todos", "todas", "cada",
])})`;

export const PATRONES_CAUSA: readonly Patron[] = Object.freeze([
  patron("CAUSA.POR", "PLEGADO", [
    `por(?! debajo de lo aportado${FIN})(?!(?<=ganancias? por) ventas${FIN})(?!(?<=decretad[oa]s? por) accion(?:es)?${FIN})`,
  ]),
  patron("CAUSA.DESDE", "PLEGADO", [`desde(?!(?<=vigentes? desde)(?: \\{h[0-9]{2}\\}|$))`]),
  patron("CAUSA.CON", "PLEGADO", [
    `con(?!(?<=especies? con) cierres? atrasad[oa]s?${FIN})(?!(?<=valor con) riesgo modelado${FIN})`,
  ]),
  patron("CAUSA.SIN", "PLEGADO", [
    `sin(?!(?<=ganancia sin) vender${FIN})(?!(?<=especies? sin) precio${FIN})(?!(?<=rentabilidad sin) vender${FIN})(?!(?<=regla sin) cierre al dia${FIN})`,
  ]),
  patron("CAUSA.CONECTOR", "PLEGADO", [
    "porque", "pues", "ya que", "dado que", "puesto que", "debid[oa]s? al?", "a causa del?", "gracias al?", "a raiz del?",
    "se deb(?:e|en|io|ieron) al?", "atribu\\p{L}*", "impulsad\\p{L}*", "motivad\\p{L}*", "provocad\\p{L}*", "causad\\p{L}*",
    "segun", "ante", "tras", "luego del?", "despues del?", "frente al?", "como", "es que", "falta del?",
  ]),
  patron("CAUSA.TRANSITIVO", "PLEGADO", [`${VERBOS_DE_MARCA}${UN_ESPACIO}${ADVERBIO}${DETERMINANTES}${ANTE_PALABRA}`]),
  patron("CAUSA.TRANSITIVO_BAJO", "MINUSCULAS", [
    `(?:b[aá]jó|bájo|${NO_ESCENARIO}bajo)${UN_ESPACIO}${ADVERBIO_TOLERANTE}${DETERMINANTES_TOLERANTES}${ANTE_PALABRA}`,
  ]),
]);
