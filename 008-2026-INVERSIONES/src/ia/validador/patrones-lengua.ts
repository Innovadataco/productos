/**
 * Patrones de lengua:
 * - CIFRA_EN_PALABRAS: números, ordinales, fracciones, «uno más», romanos, meses, días de la semana y fechas relativas,
 *   escritos en palabras, y los aproximadores pegados a una cita. Los números fundidos en una sola palabra («dosmil») los
 *   ve `esNumeroFundido` (`numeros.ts`);
 * - IDIOMA: palabras frecuentes de otras lenguas;
 * - MARCAS: lo que afirma una palabra sobre un hecho (dirección, cercanía y «hoy»), que se coteja contra las marcas del
 *   paquete (`marcas.ts`);
 * - SIN_DATO: afirmaciones de movimiento que ningún hecho respalda, que se rechazan siempre (DIRECCION_CONTRADICE): un
 *   comparativo («mayor que», «por encima») o un movimiento negado («no subió», «sin bajar», «dejó de subir»).
 * Ninguno choca con las etiquetas del catálogo: no están «un», «una», «uno» solos (artículos), «medio» (horizonte medio),
 * «caída» (caída máxima mediana), «bajo» o «alto» solos (escenarios), «igual» solo, «no cambió» como negación (es
 * estabilidad) ni «por debajo» (probabilidad de terminar por debajo de lo aportado).
 * Cambiar una lista es otra versión del validador.
 */
import { patron, patronMarca, type Patron, type PatronMarca } from "./patron";

const CIFRA_EN_PALABRAS: readonly Patron[] = [
  patron("CIFRA_EN_PALABRAS.UNIDADES", "PLEGADO", ["cero", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]),
  patron("CIFRA_EN_PALABRAS.DECENAS", "PLEGADO", ["diez", "once", "doce", "trece", "catorce", "quince", "dieci\\p{L}+", "veinte", "veinti\\p{L}+",
    "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]),
  patron("CIFRA_EN_PALABRAS.CENTENAS", "PLEGADO", ["cien", "ciento", "cientos",
    "(?:doscient|trescient|cuatrocient|quinient|seiscient|setecient|ochocient|novecient)\\p{L}*"]),
  patron("CIFRA_EN_PALABRAS.MILES", "PLEGADO", ["mil", "miles", "millon", "millones", "millar", "millares", "millardo", "millardos", "billon",
    "billones", "trillon", "trillones"]),
  patron("CIFRA_EN_PALABRAS.ORDINALES", "PLEGADO", ["primer", "primero", "primeros", "primera", "primeras", "segundo", "segundos", "segunda",
    "segundas", "tercer", "tercero", "tercera", "cuarto", "cuarta", "quinto", "quinta", "sexto", "sexta", "septimo", "septima", "octavo",
    "octava", "noveno", "novena", "decimo", "decima", "(?:milesim|centesim|undecim|duodecim|vigesim|trigesim)\\p{L}*"]),
  patron("CIFRA_EN_PALABRAS.FRACCIONES", "PLEGADO", ["mitad", "media", "tercio", "tercios", "doble", "triple", "cuadruple", "quintuple"]),
  patron("CIFRA_EN_PALABRAS.COLECTIVOS", "PLEGADO", ["par", "ambos", "ambas", "decena", "decenas", "docena", "docenas", "centena", "centenas",
    "centenar", "centenares", "veintena", "treintena"]),
  patron("CIFRA_EN_PALABRAS.PORCIENTO", "PLEGADO", ["porciento", "por cien"]),
  patron("CIFRA_EN_PALABRAS.MESES", "PLEGADO", ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre",
    "octubre", "noviembre", "diciembre"]),
  patron("CIFRA_EN_PALABRAS.DIAS_SEMANA", "PLEGADO", ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]),
  patron("CIFRA_EN_PALABRAS.DIAS_RELATIVOS", "PLEGADO", ["ayer", "anteayer", "antier", "anoche"]),
  /** Una palabra que corre la cifra que pone el código: «casi {H01}», «más de {H01}». */
  patron("CIFRA_EN_PALABRAS.APROXIMADOR", "PLEGADO", ["(?:casi|unos|unas|alrededor de|aproximadamente|mas de|menos de|apenas) \\{h[0-9]{2}\\}"]),
  /** «Uno» y «una» como cantidad, no como artículo. */
  patron("CIFRA_EN_PALABRAS.UNO", "PLEGADO", ["uno mas", "una mas", "una vez", "uno solo", "una sola", "solo uno", "solo una", "uno de cada", "una de cada"]),
  /** Un número romano de dos o más letras que sea válido («xii», «mcmxc»; «civil» y «vil» no lo son). */
  patron("CIFRA_EN_PALABRAS.ROMANO", "PLEGADO", ["(?=[ivxlcdm]{2,}(?![\\p{L}\\p{N}]))m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})"]),
];

const IDIOMA: readonly Patron[] = [
  patron("IDIOMA.INGLES", "PLEGADO", ["the", "and", "of", "is", "are", "was", "were", "with", "this", "that", "these", "those", "from", "have", "will",
    "would", "should", "your", "you", "it", "its", "for", "by", "on", "at", "to", "in", "an", "value", "values", "stock", "stocks", "share",
    "shares", "price", "prices", "portfolio", "today", "yesterday", "rose", "fell", "increase", "increased", "decrease", "decreased", "fund",
    "rate", "now", "net", "gain", "gains", "remains", "positive", "negative", "market", "markets", "up", "down", "invest", "trade"]),
  patron("IDIOMA.PORTUGUES", "PLEGADO", ["tambem", "voce", "uma", "isso", "foi", "mais", "seu", "sua", "nao", "sao", "acoes", "muito"]),
  patron("IDIOMA.FRANCES", "PLEGADO", ["avec", "dans", "pour", "une", "sont", "cette", "des", "est", "aujourd"]),
  patron("IDIOMA.ITALIANO", "PLEGADO", ["il", "della", "sono", "che", "questo", "anche", "oggi", "azioni", "perche"]),
];

const SUBE = { campo: "direccion", valor: "SUBE" } as const;
const BAJA = { campo: "direccion", valor: "BAJA" } as const;
const IGUAL = { campo: "direccion", valor: "IGUAL" } as const;

/** Con tilde (MINUSCULAS): «bajó» afirma una bajada; «bajo» es otra palabra (escenario bajo). */
const MARCAS: readonly PatronMarca[] = [
  patronMarca("DIRECCION.SUBE_VERBO", "MINUSCULAS", ["subió", "subieron", "sube", "suben", "subiendo", "ha subido", "han subido", "aumentó",
    "aumentaron", "aumenta", "aumentan", "creció", "crecieron", "crece", "crecen", "avanzó", "avanzaron", "avanza", "avanzan", "ganó", "ganaron",
    "repuntó", "repuntaron", "mejoró", "mejoraron", "incrementó", "incrementaron", "se valorizó", "se valorizaron", "se valoriza", "se recuperó",
    "se recuperaron", "se disparó", "se dispararon", "ascendió", "ascendieron", "asciende", "escaló", "escalaron", "saltó", "saltaron",
    "se fortaleció", "se fortalecieron", "superó", "superaron", "rebasó", "rebasaron", "mejora", "mejoran"], SUBE),
  patronMarca("DIRECCION.SUBE_SUSTANTIVO", "MINUSCULAS", ["subida", "subidas", "aumento", "aumentos", "alza", "alzas", "crecimiento", "incremento",
    "incrementos", "repunte", "repuntes", "avance", "valorización"], SUBE),
  patronMarca("DIRECCION.BAJA_VERBO", "MINUSCULAS", ["bajó", "bajaron", "bajan", "bajando", "ha bajado", "han bajado", "cayó", "cayeron", "cae", "caen",
    "cayendo", "descendió", "descendieron", "desciende", "disminuyó", "disminuyeron", "disminuye", "retrocedió", "retrocedieron", "retrocede",
    "perdió", "perdieron", "pierde", "pierden", "empeoró", "se redujo", "se redujeron", "se desvalorizó", "se desvalorizaron", "se contrajo",
    "se contrajeron", "se desplomó", "se desplomaron", "se hundió", "se hundieron", "cedió", "cedieron", "se debilitó", "se debilitaron",
    "empeora", "empeoran", "tocó fondo"], BAJA),
  patronMarca("DIRECCION.BAJA_SUSTANTIVO", "MINUSCULAS", ["bajada", "descenso", "descensos", "disminución", "retroceso", "pérdida", "pérdidas",
    "a la baja", "reducción", "desvalorización", "contracción"], BAJA),
  patronMarca("DIRECCION.IGUAL", "MINUSCULAS", ["mantuvo", "mantuvieron", "mantiene", "mantienen", "sin cambio", "sin cambios", "no cambió", "no cambio",
    "no cambiaron", "no varió", "no variaron", "estable", "estables", "sigue igual", "siguió igual", "quedó igual", "es igual", "es la misma",
    "es el mismo", "se sostuvo", "invariable", "sin variación", "sigue en", "siguió en", "continúa en", "continuó en", "se estancó",
    "se estancaron"], IGUAL),
  patronMarca("CERCANIA.CERCA", "MINUSCULAS", ["cerca", "cercano", "cercana", "cercanos", "cercanas", "a punto de", "próximo a", "próxima a"],
    { campo: "cercania", valor: "CERCA" }),
  patronMarca("CERCANIA.LEJOS", "MINUSCULAS", ["lejos", "lejano", "lejana", "lejanos", "lejanas", "distante", "distantes"], { campo: "cercania", valor: "LEJOS" }),
  patronMarca("FRESCURA.HOY", "MINUSCULAS", ["hoy"], { campo: "frescura", valor: "HOY" }),
];

/**
 * Movimientos que una negación da vuelta («no subió», «sin bajar», «no se ha subido»; hasta dos palabras en medio):
 * «cambi…» y «vari…» negados son estabilidad (IGUAL) y no están. Una alternativa por raíz: el candado las muta una a una.
 */
const NEGACION = "(?:no|sin|nunca|ni|tampoco|dejo de|dejaron de)(?: \\p{L}+){0,2} ";
const NEGADOS: readonly string[] = ["sub", "baj", "ca[eiy]", "crec", "aument", "dismin", "descend", "retroced", "perd", "gan(?!anc)", "avanz",
  "repunt", "mejor", "empeor", "valoriz", "desvaloriz", "recuper", "ascend", "escal", "dispar", "desplom", "hund", "ced", "fortalec",
  "debilit", "super", "rebas", "salt"];

const SIN_DATO: readonly Patron[] = [
  patron("DIRECCION.COMPARATIVO", "PLEGADO", ["mayor", "mayores", "menor", "menores", "superior", "superiores", "inferior", "inferiores", "mas alto",
    "mas alta", "mas bajo", "mas baja", "por encima", "a mas", "a menos", "mas que", "menos que"]),
  patron("DIRECCION.NEGADA", "PLEGADO", NEGADOS.map((raiz) => `${NEGACION}${raiz}\\p{L}*`)),
];

export const PATRONES_CIFRA_EN_PALABRAS: readonly Patron[] = Object.freeze(CIFRA_EN_PALABRAS);
export const PATRONES_IDIOMA: readonly Patron[] = Object.freeze(IDIOMA);
export const PATRONES_MARCA: readonly PatronMarca[] = Object.freeze(MARCAS);
export const PATRONES_SIN_DATO: readonly Patron[] = Object.freeze(SIN_DATO);
