/**
 * Patrones de CAUSA: el texto no puede atribuir un hecho a una causa («subió por la tasa», «ante el mercado», «desde el
 * cierre», «debido a…»). 008 describe lo que pasó con los datos del paquete; el porqué no está en el paquete.
 * - CAUSA.POR: «por», salvo «por debajo de lo aportado», «ganancia(s) por ventas» y «decretado por acción».
 * - CAUSA.DESDE: «desde», salvo «vigente desde» (la regla del plan vigente desde una fecha).
 * - CAUSA.CON: «con», salvo «especies con cierre atrasado» y «valor con riesgo modelado» (etiquetas del catálogo).
 * - CAUSA.CONECTOR: los conectores y locuciones de causa («porque», «debido a», «según», «ante», «tras», «como»…).
 * Corren sobre el texto plegado (sin tildes). Cada fragmento va con sus espacios literales: `patron()` los cambia por el
 * separador de frase (espacios y signos), también dentro de las miradas. Son listas negras: lo que no esté aquí lo ataja
 * el vocabulario cerrado. Cambiar una lista es otra versión del validador, con su huella nueva.
 */
import { patron, type Patron } from "./patron";

/** Lo mismo que el separador entre palabras de `patron()` (para la mirada atrás de `antes`, que no se transforma). */
const SEP = "[ ,;:()«»]+";
const FIN = "(?![\\p{L}\\p{N}])";

export const PATRONES_CAUSA: readonly Patron[] = Object.freeze([
  patron("CAUSA.POR", "PLEGADO", [
    `por(?! debajo de lo aportado${FIN})(?!(?<=ganancias? por) ventas${FIN})(?!(?<=decretad[oa]s? por) accion(?:es)?${FIN})`,
  ]),
  patron("CAUSA.DESDE", "PLEGADO", ["desde"], `(?<!vigentes?${SEP})`),
  patron("CAUSA.CON", "PLEGADO", [
    `con(?!(?<=especies? con) cierres? atrasad[oa]s?${FIN})(?!(?<=valor con) riesgo modelado${FIN})`,
  ]),
  patron("CAUSA.CONECTOR", "PLEGADO", [
    "porque", "pues", "ya que", "dado que", "puesto que", "debid[oa]s? al?", "a causa del?", "gracias al?", "a raiz del?",
    "se deb(?:e|en|io|ieron) al?", "atribu\\p{L}*", "impulsad\\p{L}*", "motivad\\p{L}*", "provocad\\p{L}*", "causad\\p{L}*",
    "segun", "ante", "tras", "luego del?", "despues del?", "frente al?", "como",
  ]),
]);
