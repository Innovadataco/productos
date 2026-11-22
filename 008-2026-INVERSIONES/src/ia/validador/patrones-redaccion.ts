/**
 * Patrones de redacción prohibida: RECOMENDACION (decirle al lector qué hacer, valorar o nombrar una compra o una venta,
 * en cualquier forma y también en otros idiomas), PREDICCION (afirmar lo que va a pasar) y TRATO (tú, vosotros o voseo).
 * Parten de las listas del plan de la fase E y las amplían con lo que encontró la revisión. Las de compra, venta y
 * adquisición van por raíz («compr…», «vend…»), así cubren clíticos, condicional y futuro.
 *
 * Ninguno choca con las etiquetas del catálogo (lo cuida `patrones.mutacion.test.ts`): por eso «vend…» no cuenta después
 * de «sin» (ganancia sin vender) ni «ventas» después de «por» (ganancia por ventas), y no están «próximo» (fecha ex del
 * próximo dividendo), «proyección», «estimado» ni el condicional, que es como se describen los escenarios.
 *
 * Límite conocido: son listas negras; una paráfrasis que no esté en ellas pasa (lo mitigan la temperatura cero, el
 * prompt y la revisión humana de la evaluación E7). Cambiar una lista es otra versión del validador.
 */
import { patron, type Patron } from "./patron";

const RECOMENDACION: readonly Patron[] = [
  patron("RECOMENDACION.COMPRA", "PLEGADO", ["compr(?!ob|end|ens|om|im|esi|esor)\\p{L}*"]),
  patron("RECOMENDACION.VENDER", "PLEGADO", ["vend\\p{L}*"], "(?<!sin )"),
  patron("RECOMENDACION.VENTA", "PLEGADO", ["ventas?"], "(?<!por )"),
  patron("RECOMENDACION.MANTENER", "PLEGADO", ["mantenga", "mantengan", "mantener", "mantenerla", "mantenerlas", "mantenerlo", "mantenerlos",
    "conserve", "conserven", "conservar", "conservarla", "conservarlo", "retenga", "retengan", "retener", "sostenga", "sostengan", "sostener"]),
  patron("RECOMENDACION.RECOMENDAR", "PLEGADO", ["recomiendo", "recomendamos", "recomienda", "recomiendan", "recomendacion", "recomendaciones",
    "recomendable", "recomendado", "recomendada"]),
  patron("RECOMENDACION.SUGERIR", "PLEGADO", ["sugiero", "sugerimos", "sugiere", "sugieren", "sugerencia", "sugerencias"]),
  patron("RECOMENDACION.ACONSEJAR", "PLEGADO", ["aconsejo", "aconsejamos", "aconseja", "aconsejable", "consejo", "consejos"]),
  patron("RECOMENDACION.DEBER", "PLEGADO", ["debe", "deben", "deberia", "deberian", "deberiamos"]),
  patron("RECOMENDACION.CONVENIR", "PLEGADO", ["conviene", "convendria", "conveniente", "convenientes"]),
  patron("RECOMENDACION.OBLIGACION", "PLEGADO", ["tiene que", "tendria que", "hay que", "habria que", "es necesario", "es preciso"]),
  patron("RECOMENDACION.MOMENTO", "PLEGADO", ["buen momento", "mal momento", "gran momento", "es hora de", "momento de (?:invertir|entrar|salir)"]),
  patron("RECOMENDACION.OPORTUNIDAD", "PLEGADO", ["oportunidad", "oportunidades", "oportuno", "oportuna"]),
  patron("RECOMENDACION.APROVECHAR", "PLEGADO", ["aprovech\\p{L}*"]),
  patron("RECOMENDACION.TOMAR_GANANCIAS", "PLEGADO", ["(?:tome|tomar|toma de|asegure|asegurar) (?:ganancias|utilidades)"]),
  patron("RECOMENDACION.AJUSTAR", "PLEGADO", ["reduzca", "reduzcan", "aumente", "aumenten", "incremente", "incrementen", "disminuya", "disminuyan"]),
  patron("RECOMENDACION.REBALANCEAR", "PLEGADO", ["rebalancee", "rebalanceen", "rebalancear", "rebalanceo"]),
  patron("RECOMENDACION.DIVERSIFICAR", "PLEGADO", ["diversifique", "diversifiquen", "diversificar"]),
  patron("RECOMENDACION.INVERTIR", "PLEGADO", ["invierta", "inviertan", "reinvierta", "reinviertan", "invertir", "desinvierta", "desinviertan", "desinvertir"]),
  patron("RECOMENDACION.ADQUIRIR", "PLEGADO", ["adqui[er]\\p{L}*"]),
  patron("RECOMENDACION.SALIR", "PLEGADO", ["liquide", "liquiden", "salga", "salgan", "salir", "retire", "retiren", "acumule", "acumulen", "espere", "esperen"]),
  patron("RECOMENDACION.OBJETIVO", "PLEGADO", ["objetivo", "objetivos", "precio meta"]),
  patron("RECOMENDACION.SENAL", "PLEGADO", ["señal", "señales"]),
  patron("RECOMENDACION.PONDERAR", "PLEGADO", ["sobreponderar", "subponderar", "infraponderar", "sobreponderacion", "infraponderacion"]),
  patron("RECOMENDACION.VALORACION", "PLEGADO", ["barata", "baratas", "barato", "baratos", "cara", "caras", "caro", "caros", "sobrevalorada",
    "sobrevaloradas", "sobrevalorado", "sobrevalorados", "subvalorada", "subvalorado", "infravalorada", "infravalorado", "atractiva",
    "atractivas", "atractivo", "atractivos", "ideal", "ideales", "prudente", "prudentes", "urgente", "urgentes", "excelente", "excelentes",
    "solido", "solida", "solidos", "solidas", "imperdible", "ganga", "vale la pena", "mejor opcion", "lo mejor", "ahora o nunca"]),
  patron("RECOMENDACION.CONSEJO", "PLEGADO", ["considere", "consideren", "evalue", "evaluen", "revise", "revisen", "analice", "analicen", "vigile",
    "vigilen", "procure", "procuren", "tenga en cuenta", "siga", "sigan", "continue", "continuen", "añada", "añadan", "agregue", "agreguen",
    "deshagase", "deshaganse", "deshacerse"]),
  patron("RECOMENDACION.ORDEN", "PLEGADO", ["stop loss", "take profit", "posicion larga", "posicion corta"]),
  patron("RECOMENDACION.EXTRANJERA", "PLEGADO", ["buy", "sell", "hold", "acheter", "kaufen", "verkaufen"]),
];

const PREDICCION: readonly Patron[] = [
  /** El futuro con tilde («subirá», «verás», «subiré») y en «-remos» («veremos»). Con tilde, casi solo lo es el futuro. */
  patron("PREDICCION.FUTURO_SIMPLE", "MINUSCULAS", ["\\p{L}+r(?:á|án|ás|é)", "(?!extremos|supremos)\\p{L}{2,}remos"]),
  /** Los futuros frecuentes escritos sin tilde. */
  patron("PREDICCION.FUTURO_SIN_TILDE", "MINUSCULAS", ["sera", "seran", "subira", "subiran", "bajara", "bajaran", "caera", "caeran", "crecera",
    "creceran", "aumentara", "aumentaran", "disminuira", "disminuiran", "llegara", "llegaran", "alcanzara", "alcanzaran", "superara",
    "superaran", "quedara", "quedaran", "habra", "tendra", "tendran", "estara", "estaran", "podra", "podran", "seguira", "seguiran",
    "continuara", "continuaran", "mejorara", "empeorara", "recuperara", "valdra", "pasara", "pasaran", "ganara", "ganaran", "perdera",
    "perderan", "cerrara", "cerraran"]),
  patron("PREDICCION.IR_A", "PLEGADO", ["(?:va|van|vamos|iba|iban|ira|iran|iria|irian|apunta|apuntan|tiende|tienden) a \\p{L}+(?:ar|er|ir)"]),
  patron("PREDICCION.ESPERAR", "PLEGADO", ["se espera", "se esperan", "se esperaba", "esperamos", "es de esperar", "cabe esperar"]),
  patron("PREDICCION.PREVER", "PLEGADO", ["preve", "prevemos", "previsto", "prevista", "previstos", "previstas", "prevision", "previsiones", "previsiblemente"]),
  patron("PREDICCION.PRONOSTICO", "PLEGADO", ["pronostico", "pronosticos", "pronostica", "pronostican", "pronosticamos", "predice", "predicen",
    "prediccion", "predicciones", "predecir", "anticipamos", "vaticina"]),
  patron("PREDICCION.GARANTIA", "PLEGADO", ["garantiza", "garantizan", "garantizado", "garantizada", "garantia", "garantias", "asegura", "aseguran",
    "asegurado", "asegurada"]),
  patron("PREDICCION.SIN_RIESGO", "PLEGADO", ["sin riesgo", "sin riesgos", "libre de riesgo", "riesgo nulo", "ningun riesgo"]),
  patron("PREDICCION.CERTEZA", "PLEGADO", ["con certeza", "sin duda", "seguro que", "con seguridad", "seguramente", "indudablemente", "inevitable",
    "inevitablemente", "sin falta", "de seguro"]),
  patron("PREDICCION.PROBABLE", "PLEGADO", ["probablemente", "posiblemente", "quiza", "quizas", "tal vez", "a lo mejor"]),
  patron("PREDICCION.TENDENCIA", "PLEGADO", ["alcista", "alcistas", "bajista", "bajistas", "tendencia", "tendencias"]),
  patron("PREDICCION.FUTURO_TIEMPO", "PLEGADO", ["mañana", "proximamente", "en el futuro", "a futuro", "mas adelante", "proximos dias",
    "proximas semanas", "proximos meses", "el proximo año"]),
];

const TRATO: readonly Patron[] = [
  patron("TRATO.TU", "PLEGADO", ["tu", "tus", "tuyo", "tuya", "tuyos", "tuyas"]),
  patron("TRATO.TE", "PLEGADO", ["te", "ti", "contigo"]),
  patron("TRATO.VOSOTROS", "PLEGADO", ["vosotros", "vosotras", "vuestro", "vuestra", "vuestros", "vuestras", "os"]),
  patron("TRATO.VOS", "PLEGADO", ["vos"]),
  /** Voseo: con tilde (sin ella serían otras palabras: «tenes», «podes»). */
  patron("TRATO.VOSEO_VERBO", "MINUSCULAS", ["sos", "tenés", "podés", "querés", "sabés", "hacés", "decís", "vení", "mirá", "fijate", "tené", "andá",
    "comprá", "vendé", "esperá", "revisá", "pensá", "creés", "debés"]),
  /** Tú: con tilde donde la palabra sin ella es otra («estás» y «estas»). */
  patron("TRATO.TU_VERBO", "MINUSCULAS", ["tienes", "puedes", "debes", "quieres", "sabes", "eres", "estás", "haces", "vas", "ves", "has", "piensas",
    "crees", "inviertes", "vendes", "ganas", "pierdes", "deberías", "podrías", "tendrías", "fíjate"]),
  /** El imperativo de tú, el que dirige al lector («revisa», «mira», «cuídate»). */
  patron("TRATO.TU_IMPERATIVO", "PLEGADO", ["revisa", "mira", "aprovecha", "considera", "recuerda", "piensa", "evalua", "analiza", "vigila", "decide",
    "elige", "actua", "cuidate", "ten en cuenta", "invierte", "diversifica", "ahorra"]),
  /** Al inicio de la frase, un verbo neutro en tercera persona se lee como orden de tú («Suma el valor…»). */
  patron("TRATO.IMPERATIVO_INICIAL", "PLEGADO", ["suma", "cuenta", "paga", "marca", "registra", "muestra", "cierra", "indica", "representa",
    "alcanza", "llega", "queda"], "^"),
];

export const PATRONES_RECOMENDACION: readonly Patron[] = Object.freeze(RECOMENDACION);
export const PATRONES_PREDICCION: readonly Patron[] = Object.freeze(PREDICCION);
export const PATRONES_TRATO: readonly Patron[] = Object.freeze(TRATO);
