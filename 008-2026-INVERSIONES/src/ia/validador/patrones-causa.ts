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
 * «cuando» y los verbos de atribución de la base («corresponde», «equivale», «representa», «indica», «muestra») no están
 * aquí: ya no son palabras del vocabulario (`vocabulario.ts`) y los rechaza IDIOMA.VOCABULARIO. «pero» sí vale: es de
 * contraste, no de causa. «para» queda abierto: sale de etiquetas y es de riesgo bajo.
 * Corren sobre el texto plegado (sin tildes). Cada fragmento va con sus espacios literales: `patron()` los cambia por el
 * separador de frase (espacios y signos), también dentro de las miradas. Son listas negras: lo que no esté aquí lo ataja
 * el vocabulario cerrado. Cambiar una lista es otra versión del validador, con su huella nueva.
 */
import { patron, type Patron } from "./patron";

const FIN = "(?![\\p{L}\\p{N}])";

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
    "segun", "ante", "tras", "luego del?", "despues del?", "frente al?", "como", "es que", "a falta del?",
  ]),
]);
