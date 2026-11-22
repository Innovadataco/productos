/**
 * Patrones de lengua: CIFRA_EN_PALABRAS (números, ordinales, fracciones, meses, días de la semana y fechas relativas,
 * escritos en palabras, y los aproximadores pegados a una cita), IDIOMA (palabras frecuentes de otras lenguas) y las
 * MARCAS que afirma una palabra sobre un hecho (dirección, cercanía y «hoy»), que se cotejan contra las marcas del
 * paquete. Ninguno choca con las etiquetas del catálogo: no están «un», «una», «uno» (artículos), «medio» (horizonte
 * medio), «caída» (caída máxima mediana) ni «bajo» o «alto» (escenarios).
 * Cambiar una lista es otra versión del validador.
 */
import { palabras, patron, patronMarca, type Patron, type PatronMarca } from "./patron";

const CIFRA_EN_PALABRAS: readonly Patron[] = [
  patron("CIFRA_EN_PALABRAS.UNIDADES", "PLEGADO", palabras("cero", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve")),
  patron("CIFRA_EN_PALABRAS.DECENAS", "PLEGADO", palabras("diez", "once", "doce", "trece", "catorce", "quince", "dieci\\p{L}+", "veinte", "veinti\\p{L}+", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa")),
  patron("CIFRA_EN_PALABRAS.CENTENAS", "PLEGADO", palabras("cien", "ciento", "cientos", "(?:doscient|trescient|cuatrocient|quinient|seiscient|setecient|ochocient|novecient)\\p{L}*")),
  patron("CIFRA_EN_PALABRAS.MILES", "PLEGADO", palabras("mil", "miles", "millon", "millones", "millar", "millares", "millardo", "millardos", "billon", "billones")),
  patron("CIFRA_EN_PALABRAS.ORDINALES", "PLEGADO", palabras("primer", "primero", "primeros", "primera", "primeras", "segundo", "segundos", "segunda", "segundas", "tercer", "tercero", "tercera", "cuarto", "cuarta", "quinto", "quinta", "sexto", "sexta", "septimo", "septima", "octavo", "octava", "noveno", "novena", "decimo", "decima")),
  patron("CIFRA_EN_PALABRAS.FRACCIONES", "PLEGADO", palabras("mitad", "media", "tercio", "tercios", "doble", "triple", "cuadruple", "quintuple")),
  patron("CIFRA_EN_PALABRAS.COLECTIVOS", "PLEGADO", palabras("par", "ambos", "ambas", "decena", "decenas", "docena", "docenas", "centena", "centenas", "centenar", "centenares", "veintena")),
  patron("CIFRA_EN_PALABRAS.PORCIENTO", "PLEGADO", palabras("porciento", "por cien")),
  patron("CIFRA_EN_PALABRAS.MESES", "PLEGADO", palabras("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre")),
  patron("CIFRA_EN_PALABRAS.DIAS_SEMANA", "PLEGADO", palabras("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")),
  patron("CIFRA_EN_PALABRAS.DIAS_RELATIVOS", "PLEGADO", palabras("ayer", "anteayer", "antier", "anoche")),
  /** Una palabra que corre la cifra que pone el código: «casi {H01}», «más de {H01}». */
  patron("CIFRA_EN_PALABRAS.APROXIMADOR", "PLEGADO", palabras("(?:casi|unos|unas|alrededor de|aproximadamente|mas de|menos de|apenas) \\{h[0-9]{2}\\}")),
];

const IDIOMA: readonly Patron[] = [
  patron("IDIOMA.INGLES", "PLEGADO", palabras("the", "and", "of", "is", "are", "was", "were", "with", "this", "that", "these", "those", "from", "have", "will", "would", "should", "your", "you", "it", "its", "for", "by", "on", "at", "to", "in", "an", "value", "values", "stock", "stocks", "share", "shares", "price", "prices", "portfolio", "today", "yesterday", "rose", "fell", "increase", "increased", "decrease", "decreased", "fund", "rate")),
  patron("IDIOMA.PORTUGUES", "PLEGADO", palabras("tambem", "voce", "uma", "isso", "foi", "mais", "seu", "sua", "nao", "sao", "acoes", "muito")),
  patron("IDIOMA.FRANCES", "PLEGADO", palabras("avec", "dans", "pour", "une", "sont", "cette", "des", "est", "aujourd")),
  patron("IDIOMA.ITALIANO", "PLEGADO", palabras("il", "della", "sono", "che", "questo", "anche", "oggi", "azioni", "perche")),
];

const SUBE = { campo: "direccion", valor: "SUBE" } as const;
const BAJA = { campo: "direccion", valor: "BAJA" } as const;
const IGUAL = { campo: "direccion", valor: "IGUAL" } as const;

/** Con tilde (MINUSCULAS): «bajó» afirma una bajada; «bajo» es otra palabra (escenario bajo). */
const MARCAS: readonly PatronMarca[] = [
  patronMarca("DIRECCION.SUBE_VERBO", "MINUSCULAS", palabras("subió", "subieron", "sube", "suben", "subiendo", "ha subido", "han subido", "aumentó", "aumentaron", "aumenta", "aumentan", "creció", "crecieron", "crece", "crecen", "avanzó", "avanzaron", "avanza", "avanzan", "ganó", "ganaron", "repuntó", "repuntaron", "mejoró", "mejoraron", "incrementó", "incrementaron", "se valorizó", "se valorizaron", "se valoriza", "se recuperó", "se recuperaron"), SUBE),
  patronMarca("DIRECCION.SUBE_SUSTANTIVO", "MINUSCULAS", palabras("subida", "subidas", "aumento", "aumentos", "alza", "alzas", "al alza", "crecimiento", "incremento", "incrementos", "repunte", "repuntes", "avance", "valorización"), SUBE),
  patronMarca("DIRECCION.BAJA_VERBO", "MINUSCULAS", palabras("bajó", "bajaron", "bajan", "bajando", "ha bajado", "han bajado", "cayó", "cayeron", "cae", "caen", "cayendo", "descendió", "descendieron", "desciende", "disminuyó", "disminuyeron", "disminuye", "retrocedió", "retrocedieron", "retrocede", "perdió", "perdieron", "pierde", "pierden", "empeoró", "se redujo", "se redujeron", "se desvalorizó", "se desvalorizaron", "se contrajo"), BAJA),
  patronMarca("DIRECCION.BAJA_SUSTANTIVO", "MINUSCULAS", palabras("bajada", "descenso", "descensos", "disminución", "retroceso", "pérdida", "pérdidas", "a la baja", "reducción", "desvalorización", "contracción"), BAJA),
  patronMarca("DIRECCION.IGUAL", "MINUSCULAS", palabras("se mantuvo", "se mantuvieron", "se mantiene", "se mantienen", "sin cambio", "sin cambios", "no cambió", "no cambiaron", "estable", "estables", "igual", "iguales", "se sostuvo", "invariable", "sin variación"), IGUAL),
  patronMarca("CERCANIA.CERCA", "MINUSCULAS", palabras("cerca", "cercano", "cercana", "cercanos", "cercanas", "a punto de", "próximo a", "próxima a"), { campo: "cercania", valor: "CERCA" }),
  patronMarca("CERCANIA.LEJOS", "MINUSCULAS", palabras("lejos", "lejano", "lejana", "lejanos", "lejanas", "distante", "distantes"), { campo: "cercania", valor: "LEJOS" }),
  patronMarca("FRESCURA.HOY", "MINUSCULAS", palabras("hoy"), { campo: "frescura", valor: "HOY" }),
];

export const PATRONES_CIFRA_EN_PALABRAS: readonly Patron[] = Object.freeze(CIFRA_EN_PALABRAS);
export const PATRONES_IDIOMA: readonly Patron[] = Object.freeze(IDIOMA);
export const PATRONES_MARCA: readonly PatronMarca[] = Object.freeze(MARCAS);
