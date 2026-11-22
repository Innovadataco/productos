/**
 * Patrones de redacción prohibida: RECOMENDACION (decirle al lector qué hacer, o nombrar una compra o una venta),
 * PREDICCION (afirmar lo que va a pasar) y TRATO (tú, vosotros o voseo). Parten de las listas del plan de la fase E y
 * las amplían. Ninguno choca con las etiquetas del catálogo (lo cuida `patrones.mutacion.test.ts`): por eso no están
 * «vender» después de «sin» (ganancia sin vender), «ventas» (ganancia por ventas), «próximo» (fecha ex del próximo
 * dividendo), «proyección», «estimado» ni el condicional, que es como se describen los escenarios.
 * Cambiar una lista es otra versión del validador.
 */
import { palabras, patron, type Patron } from "./patron";

const RECOMENDACION: readonly Patron[] = [
  patron("RECOMENDACION.COMPRE", "PLEGADO", palabras("compre", "compren", "comprela", "comprelas", "comprelo", "comprelos")),
  patron("RECOMENDACION.VENDA", "PLEGADO", palabras("venda", "vendan", "vendala", "vendalas", "vendalo", "vendalos")),
  patron("RECOMENDACION.COMPRAR_VENDER", "PLEGADO", /(?<![\p{L}\p{N}])(?<!sin )(?:comprar|vender)(?![\p{L}\p{N}])/u),
  patron("RECOMENDACION.COMPRA_VENTA", "PLEGADO", palabras("compra", "compras", "venta", "comprador", "compradores", "vendedor", "vendedores")),
  patron("RECOMENDACION.MANTENGA", "PLEGADO", palabras("mantenga", "mantengan", "conserve", "conserven", "sostenga", "sostengan")),
  patron("RECOMENDACION.RECOMENDAR", "PLEGADO", palabras("recomiendo", "recomendamos", "recomienda", "recomiendan", "recomendacion", "recomendaciones", "recomendable", "recomendado", "recomendada")),
  patron("RECOMENDACION.SUGERIR", "PLEGADO", palabras("sugiero", "sugerimos", "sugiere", "sugieren", "sugerencia", "sugerencias")),
  patron("RECOMENDACION.ACONSEJAR", "PLEGADO", palabras("aconsejo", "aconsejamos", "aconseja", "aconsejable", "consejo", "consejos")),
  patron("RECOMENDACION.DEBER", "PLEGADO", palabras("debe", "deben", "deberia", "deberian", "deberiamos")),
  patron("RECOMENDACION.CONVENIR", "PLEGADO", palabras("conviene", "convendria", "conveniente", "convenientes")),
  patron("RECOMENDACION.OBLIGACION", "PLEGADO", palabras("tiene que", "tendria que", "hay que", "habria que", "es necesario", "es preciso")),
  patron("RECOMENDACION.MOMENTO", "PLEGADO", palabras("buen momento", "mal momento", "gran momento", "momento ideal", "es hora de", "momento de (?:invertir|entrar|salir)")),
  patron("RECOMENDACION.OPORTUNIDAD", "PLEGADO", palabras("oportunidad", "oportunidades", "oportuno", "oportuna")),
  patron("RECOMENDACION.APROVECHAR", "PLEGADO", palabras("aproveche", "aprovechen", "aprovechar")),
  patron("RECOMENDACION.TOMAR_GANANCIAS", "PLEGADO", palabras("(?:tome|tomar|toma de|asegure|asegurar) (?:ganancias|utilidades)")),
  patron("RECOMENDACION.AJUSTAR", "PLEGADO", palabras("reduzca", "reduzcan", "aumente", "aumenten", "incremente", "incrementen", "disminuya", "disminuyan")),
  patron("RECOMENDACION.REBALANCEAR", "PLEGADO", palabras("rebalancee", "rebalanceen", "rebalancear", "rebalanceo")),
  patron("RECOMENDACION.DIVERSIFICAR", "PLEGADO", palabras("diversifique", "diversifiquen", "diversificar")),
  patron("RECOMENDACION.INVERTIR", "PLEGADO", palabras("invierta", "inviertan", "reinvierta", "reinviertan", "invertir")),
  patron("RECOMENDACION.SALIR", "PLEGADO", palabras("liquide", "liquiden", "salga", "salgan", "retire", "retiren", "acumule", "acumulen", "espere", "esperen")),
  patron("RECOMENDACION.OBJETIVO", "PLEGADO", palabras("objetivo", "objetivos", "precio meta")),
  patron("RECOMENDACION.SENAL", "PLEGADO", palabras("señal", "señales")),
  patron("RECOMENDACION.PONDERAR", "PLEGADO", palabras("sobreponderar", "subponderar", "infraponderar", "sobreponderacion", "infraponderacion")),
  patron("RECOMENDACION.VALORACION", "PLEGADO", palabras("barata", "baratas", "barato", "baratos", "cara", "caras", "caro", "caros", "sobrevalorada", "sobrevaloradas", "sobrevalorado", "sobrevalorados", "subvalorada", "subvalorado", "infravalorada", "infravalorado")),
  patron("RECOMENDACION.CONSEJO", "PLEGADO", palabras("considere", "consideren", "evalue", "evaluen", "revise", "revisen", "analice", "analicen", "vigile", "vigilen", "procure", "procuren", "tenga en cuenta")),
  patron("RECOMENDACION.ORDEN", "PLEGADO", palabras("stop loss", "take profit", "posicion larga", "posicion corta")),
];

const PREDICCION: readonly Patron[] = [
  /** El futuro simple con tilde: «subirá», «será», «habrá». Con tilde, en español casi solo lo es el futuro. */
  patron("PREDICCION.FUTURO_SIMPLE", "MINUSCULAS", /(?<![\p{L}\p{N}])\p{L}+rán?(?![\p{L}\p{N}])/u),
  /** Los futuros frecuentes escritos sin tilde. */
  patron("PREDICCION.FUTURO_SIN_TILDE", "MINUSCULAS", palabras("sera", "seran", "subira", "subiran", "bajara", "bajaran", "caera", "caeran", "crecera", "creceran", "aumentara", "aumentaran", "disminuira", "disminuiran", "llegara", "llegaran", "alcanzara", "alcanzaran", "superara", "superaran", "quedara", "quedaran", "habra", "tendra", "tendran", "estara", "estaran", "podra", "podran", "seguira", "seguiran", "continuara", "continuaran", "mejorara", "empeorara", "recuperara", "valdra", "pasara", "pasaran")),
  patron("PREDICCION.IR_A", "PLEGADO", palabras("(?:va|van|vamos|iba|iban|ira|iran|iria|irian) a \\p{L}+(?:ar|er|ir)")),
  patron("PREDICCION.ESPERAR", "PLEGADO", palabras("se espera", "se esperan", "se esperaba", "esperamos", "es de esperar", "cabe esperar")),
  patron("PREDICCION.PREVER", "PLEGADO", palabras("se preve", "preve", "prevemos", "previsto", "prevista", "previstos", "previstas", "prevision", "previsiones", "previsiblemente")),
  patron("PREDICCION.PRONOSTICO", "PLEGADO", palabras("pronostico", "pronosticos", "pronostica", "pronostican", "pronosticamos", "predice", "predicen", "prediccion", "predicciones", "predecir", "anticipamos", "vaticina")),
  patron("PREDICCION.GARANTIA", "PLEGADO", palabras("garantiza", "garantizan", "garantizado", "garantizada", "garantia", "garantias", "asegura", "aseguran", "asegurado", "asegurada")),
  patron("PREDICCION.SIN_RIESGO", "PLEGADO", palabras("sin riesgo", "sin riesgos", "libre de riesgo", "riesgo nulo", "ningun riesgo")),
  patron("PREDICCION.CERTEZA", "PLEGADO", palabras("con certeza", "sin duda", "seguro que", "con seguridad", "seguramente", "indudablemente", "inevitable", "inevitablemente", "sin falta", "de seguro")),
  patron("PREDICCION.PROBABLE", "PLEGADO", palabras("probablemente", "posiblemente", "quiza", "quizas", "tal vez", "a lo mejor")),
  patron("PREDICCION.TENDENCIA", "PLEGADO", palabras("alcista", "alcistas", "bajista", "bajistas", "tendencia", "tendencias")),
  patron("PREDICCION.FUTURO_TIEMPO", "PLEGADO", palabras("mañana", "pasado mañana", "proximamente", "en el futuro", "a futuro", "mas adelante", "proximos dias", "proximas semanas", "proximos meses", "el proximo año")),
];

const TRATO: readonly Patron[] = [
  patron("TRATO.TU", "PLEGADO", palabras("tu", "tus", "tuyo", "tuya", "tuyos", "tuyas")),
  patron("TRATO.TE", "PLEGADO", palabras("te", "ti", "contigo")),
  patron("TRATO.VOSOTROS", "PLEGADO", palabras("vosotros", "vosotras", "vuestro", "vuestra", "vuestros", "vuestras", "os")),
  patron("TRATO.VOS", "PLEGADO", palabras("vos")),
  /** Voseo: con tilde (sin ella serían otras palabras: «tenes», «podes»). */
  patron("TRATO.VOSEO_VERBO", "MINUSCULAS", palabras("sos", "tenés", "podés", "querés", "sabés", "hacés", "decís", "vení", "mirá", "fijate", "tené", "andá", "comprá", "vendé", "esperá", "revisá", "pensá", "creés", "debés")),
  /** Tú: con tilde donde la palabra sin ella es otra («estás» y «estas»). */
  patron("TRATO.TU_VERBO", "MINUSCULAS", palabras("tienes", "puedes", "debes", "quieres", "sabes", "eres", "estás", "haces", "vas", "ves", "has", "piensas", "crees", "inviertes", "vendes", "ganas", "pierdes", "deberías", "podrías", "tendrías", "fíjate")),
];

export const PATRONES_RECOMENDACION: readonly Patron[] = Object.freeze(RECOMENDACION);
export const PATRONES_PREDICCION: readonly Patron[] = Object.freeze(PREDICCION);
export const PATRONES_TRATO: readonly Patron[] = Object.freeze(TRATO);
