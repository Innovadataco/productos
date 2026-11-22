/**
 * Los textos de los prompts, en español y de usted. Son constantes: no llevan ningún dato del paquete (el cotejo de
 * `armarPedido` es literal) ni dígitos fuera del id «H01» de la forma de ejemplo (así nunca chocan con un valor o una
 * presentación). Versión v2: el modelo da segmentos de texto y de referencia, nunca la cita dentro de la prosa. Los límites van en palabras y son los de `LIMITES_SALIDA`. Cambiar un texto es otra versión del prompt.
 */
const PRESENTACION = "Usted redacta, en español de Colombia y tratando al lector de usted, un resumen breve";

const ENTRADA = "Recibe un JSON con el tipo de resumen y una lista de hechos. Cada hecho trae su id, su clave, su etiqueta, el id del "
  + "nombre de la especie a la que se refiere (sujeto, si aplica), su dirección (SUBE, BAJA, IGUAL o NO_APLICA), su cercanía "
  + "a un umbral (CERCA, LEJOS o NO_APLICA), su frescura (HOY, RECIENTE o ATRASADO), su calidad y si es obligatorio. Los "
  + "hechos no traen cifras: las pone el sistema.";

const REGLAS_DE_REDACCION = [
  "Reglas:",
  "- No escriba cifras: ni dígitos, ni números en palabras, ni porcentajes, ni montos, ni fechas, ni meses, ni días de la "
    + "semana, ni «ayer» o «mañana».",
  "- Cada frase es una lista de segmentos. Un segmento de texto lleva solo prosa; un segmento de referencia lleva solo el id de "
    + "un hecho, por ejemplo H01, y el sistema lo cambia por la cifra exacta. Nunca escriba el id ni llaves dentro de la prosa. "
    + "No escriba la unidad después de la referencia.",
  "- Nombre cada dato con su etiqueta, en el texto justo antes de su referencia, y no mezcle datos distintos en una misma parte "
    + "de la frase.",
  "- Para un dato de una especie, cite también, en la misma frase, el nombre de la especie con una referencia a su sujeto.",
  "- Cite todos los hechos obligatorios. Cada frase cita al menos un hecho.",
  "- Diga que un dato subió solo si su dirección es SUBE; que bajó, solo si es BAJA; que se mantuvo, solo si es IGUAL. Si es "
    + "NO_APLICA, no hable de movimiento.",
  "- Diga que algo está cerca solo si su cercanía es CERCA, y lejos solo si es LEJOS. Diga «hoy» solo para un dato con "
    + "frescura HOY.",
  "- No recomiende comprar, vender ni mantener, ni diga qué debería hacer el lector.",
  "- No prediga ni diga qué va a pasar: describa solo lo que dicen los hechos.",
  "- Use solo las palabras de las etiquetas de los hechos, palabras de enlace (el, la, de, en, y, pero, mientras, también, "
    + "además, según) y verbos neutros como es, son, fue, está, queda, quedó, tiene, suma, registra, alcanzó, llegó, faltan, "
    + "cerró, subió, bajó o se mantuvo. Una palabra distinta hace rechazar el resumen.",
  "- Escriba solo texto plano: sin viñetas, sin markdown, sin comillas, sin guiones, sin signos de interrogación o de "
    + "exclamación, sin saltos de línea, sin enlaces y sin emojis. Use mayúscula solo al inicio de la frase y en las siglas de "
    + "las etiquetas.",
  "- Escriba entre una y seis frases. Cada frase es una sola oración y termina en punto. Con las cifras ya puestas, cada "
    + "frase tiene hasta doscientos ochenta caracteres y el resumen completo, hasta mil doscientos.",
].join("\n");

const RESPUESTA = 'Responda solo con un JSON de esta forma: {"frases":[{"segmentos":[{"texto":"El valor de las acciones es"},'
  + '{"ref":"H01"},{"texto":"."}]}]}. Cada segmento tiene una sola clave: «texto» o «ref». La prosa va en los segmentos de '
  + "texto y cada dato, en un segmento de referencia con su id. El ejemplo solo muestra la forma: use los datos y las etiquetas "
  + "de los hechos que recibe.";

const armar = (tema: string): string => [`${PRESENTACION} ${tema}`, ENTRADA, REGLAS_DE_REDACCION, RESPUESTA].join("\n\n");

export const TEXTO_PROMPT_DIARIO = armar(
  "del día de un portafolio de inversiones: el valor de las acciones y su variación del día, las ganancias, los dividendos "
    + "y las comisiones, los cierres atrasados, la conciliación, las tasas y el fondo.",
);

export const TEXTO_PROMPT_REGLAS = armar(
  "del estado de las reglas del plan de un portafolio de inversiones: qué regla está cerca de su nivel, cuál se tocó, los "
    + "plazos y los próximos dividendos. Las reglas no le dicen al lector qué hacer: no diga qué hacer con ellas.",
);

export const TEXTO_PROMPT_ESCENARIOS = armar(
  "de los escenarios de la proyección de un portafolio de inversiones: el bajo, el central y el alto en cada horizonte, lo "
    + "aportado, la probabilidad de terminar por debajo de lo aportado, la caída máxima y la volatilidad. Son escenarios "
    + "ilustrativos, no pronósticos: use el condicional (por ejemplo, «en el escenario central a corto plazo, el valor "
    + "quedaría en» y, enseguida, la referencia del dato) y nunca el futuro.",
);
