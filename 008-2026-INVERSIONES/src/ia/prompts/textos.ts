/**
 * Los textos de los prompts, en español y de usted. Son constantes: no llevan ningún dato del paquete (el cotejo de
 * `armarPedido` es literal) ni dígitos fuera del id «H01» de la forma de ejemplo (así nunca chocan con un valor o una
 * presentación). Versión v2: el modelo da segmentos de texto y de referencia, nunca la cita dentro de la prosa. Versión v3:
 * el nombre de la especie sale del campo `especie` de la vista (ya resuelto), sin recorrer la cadena de `sujeto`, y la
 * regla de no recomendar no usa palabras de consejo (el candado de lenguaje de los prompts). Los límites van en palabras y son los de `LIMITES_SALIDA`. Cambiar un texto es otra versión del prompt.
 * DIARIO v4: el código escribe los obligatorios (`validador/obligatorias.ts`), así que el prompt no manda citarlos; el modelo
 * escribe de una a cuatro frases con los demás hechos, con ejemplos de etiquetas no obligatorias y los límites de su parte.
 * Los textos de REGLAS y ESCENARIOS (v3) no cambian: cada uno sigue siendo el mismo, byte a byte.
 * DIARIO v5: la viñeta de las especies trae un molde por dato (`moldes-diario.ts`), un dato de especie por frase, y prohíbe «misma» y «mismo».
 */
import { textoDeMoldesDiario } from "./moldes-diario";

const PRESENTACION = "Usted redacta, en español de Colombia y tratando al lector de usted, un resumen breve";

const ENTRADA = "Recibe un JSON con el tipo de resumen y una lista de hechos. Cada hecho trae su id, su clave, su etiqueta, el id del "
  + "hecho del que depende (sujeto, si aplica), el id del nombre de la especie de la que es el dato (especie, si aplica), su dirección (SUBE, BAJA, IGUAL o NO_APLICA), su cercanía "
  + "a un umbral (CERCA, LEJOS o NO_APLICA), su frescura (HOY, RECIENTE o ATRASADO), su calidad y si es obligatorio. Los "
  + "hechos no traen cifras: las pone el sistema.";

const CITAR_OBLIGATORIOS =
"- Cite todos los hechos obligatorios, sin falta. Procedimiento: recorra la lista de hechos en su orden; cada vez que un hecho "
    + "tenga obligatorio verdadero, escriba la frase de ese hecho (una frase por hecho obligatorio, o dos unidos con «y»), en "
    + "ese mismo orden, sin saltarse ninguno. Termine ese recorrido antes de agregar nada más; solo si sobran frases (hasta "
    + "seis), agregue otros hechos. Los hechos obligatorios son pocos (no más de seis, con los nombres de especie incluidos), "
    + "así que caben. Cada frase cita al menos un hecho.";

const LARGO_DEL_RESUMEN =
"- Escriba entre una y seis frases. Con las cifras ya puestas, cada frase tiene hasta doscientos ochenta caracteres y el "
    + "resumen completo, hasta mil doscientos.";

/** La viñeta de las especies de REGLAS y ESCENARIOS (v3): el DIARIO usa la suya, con moldes (`ESPECIE_DEL_DIARIO`). */
const ESPECIE_DE_SIEMPRE =
  "- Un hecho con el campo especie es un dato de una especie: cite el id de su campo especie en una referencia, en la misma "
    + "frase, justo después de «de la especie» y antes del verbo; luego cite el dato con su propio id. No use el campo sujeto "
    + "para hallar la especie: el campo especie ya trae el id del nombre, y nunca cite el nombre de otra especie en esa frase. "
    + "Las dos referencias son distintas: la primera es el id del nombre (el valor del campo especie) y la segunda, el id del "
    + "propio dato; nunca ponga el id del dato después de «de la especie», ni el id del nombre en el lugar del dato. En los "
    + "ejemplos, las dos referencias muestran el mismo id solo por la forma. El nombre de una especie nunca va solo en una frase («el nombre de "
    + "la especie es…» está mal): va dentro de la frase de un dato de esa especie. No escriba «especie» más de una vez seguida.";

/**
 * Las reglas de redacción, las mismas para los tres tipos salvo dos viñetas: la de los hechos obligatorios y la del largo (y la de las especies, que el DIARIO v5 cambia por moldes).
 * REGLAS y ESCENARIOS usan las de siempre (v3); el DIARIO usa las suyas.
 */
const reglasDeRedaccion = (obligatorios: string, largo: string, especie: string = ESPECIE_DE_SIEMPRE): string => [
  "Reglas de contenido:",
  "- No escriba cifras: ni dígitos, ni números en palabras, ni porcentajes, ni montos, ni fechas, ni meses, ni días de la "
    + "semana, ni «ayer» o «mañana». La cifra la pone el sistema donde usted pone la referencia.",
  "- Cada frase es una lista de segmentos. Un segmento de texto lleva solo prosa; un segmento de referencia lleva solo el id de "
    + "un hecho, por ejemplo H01, y el sistema lo cambia por la cifra exacta. Nunca escriba el id ni llaves dentro de la prosa. "
    + "No escriba la unidad después de la referencia.",
  obligatorios,
  "- Cada elemento de la lista de frases es una sola oración. Para decir otra cosa, abra otra frase en la lista: cierre la "
    + "frase con el segmento de texto del punto y empiece otro elemento de la lista. Incorrecto: un elemento con segmentos "
    + "texto, referencia, texto de punto y luego más segmentos de otra oración. Correcto: un elemento por oración.",
  "- Cada dato se escribe con su etiqueta completa, tal cual, justo antes de su referencia, y la referencia ocupa el lugar de "
    + "la cifra. La referencia nunca queda suelta al final ni sin su etiqueta. No use adjetivos para valorar (como baja, alta, bajista o lejos) salvo los permitidos.",
  "- Un solo dato por parte de la frase: si cita dos, sepárelos con «y» o «pero» y repita la etiqueta del segundo. Nunca ponga "
    + "dos referencias seguidas sin palabras en medio.",
  especie,
  "- Hable de movimiento solo cuando el hecho tiene dirección: subió, solo si es SUBE; bajó, solo si es BAJA; se mantuvo, solo si "
    + "es IGUAL, y ese verbo va solo, nunca después de «es» (no «es sube»), en la misma parte de la frase y junto al dato cuya dirección es esa. Si es NO_APLICA, no use verbos "
    + "de movimiento. En duda, no los use.",
  "- Diga cerca solo junto a un dato con cercanía CERCA y lejos solo junto a uno con LEJOS; no use esas palabras en otro caso. "
    + "Diga hoy solo junto a un dato con frescura HOY. No use alto, bajo, caída ni justo si no están en la etiqueta del dato.",
  "- No recomiende comprar, vender ni mantener, ni le diga al lector qué hacer.",
  "- No prediga ni diga qué va a pasar: describa solo lo que dicen los hechos.",
  "- Use solo las palabras de las etiquetas de los hechos, palabras de enlace (el, la, de, en, y, pero, mientras, también, "
    + "además, según) y verbos neutros como es, son, fue, está, queda, quedó, tiene, suma, registra, alcanzó, llegó, faltan, "
    + "cerró, subió, bajó o se mantuvo. Una palabra distinta hace rechazar el resumen: no agregue adjetivos ni comentarios.",
  "Reglas de forma:",
  "- Cada frase es una sola oración, con un solo punto, al final, escrito como el último segmento de texto («.»). No ponga "
    + "otro punto dentro de la frase: para seguir, use «y», «pero» o coma.",
  "- Empiece cada frase con mayúscula y no use otra mayúscula, salvo las siglas de las etiquetas.",
  "- Un solo espacio entre palabras, ninguno al inicio ni al final de la frase. Ponga el espacio al empezar el segmento de texto "
    + "que sigue a una referencia (por ejemplo «, y la ganancia total es»), y el signo de puntuación pegado a la referencia.",
  "- Escriba solo texto plano: sin viñetas, sin markdown, sin comillas, sin guiones, sin signos de interrogación o de "
    + "exclamación, sin saltos de línea, sin enlaces y sin emojis.",
  largo,
].join("\n");

const REGLAS_DE_REDACCION = reglasDeRedaccion(CITAR_OBLIGATORIOS, LARGO_DEL_RESUMEN);

/** El DIARIO v4: el sistema escribe los obligatorios; el modelo, de una a cuatro frases con los demás (y hasta seiscientos caracteres). */
const NO_ESCRIBIR_OBLIGATORIOS =
  "- Los hechos con obligatorio verdadero los escribe el sistema por su cuenta: no los escriba. Escriba solo frases con hechos de "
    + "obligatorio falso, de los más útiles para el lector. Cada frase cita al menos un hecho.";

const LARGO_DEL_DIARIO =
  "- Escriba entre una y cuatro frases. Con las cifras ya puestas, cada frase tiene hasta doscientos ochenta caracteres y todas "
    + "sus frases juntas, hasta seiscientos.";

/**
 * El DIARIO v5: las etiquetas de especie ya traen «de la especie» y el modelo las repetía («de la especie de la especie»),
 * o abría la segunda cita con «la misma especie» (palabra fuera del vocabulario, a propósito). Un molde por dato, un dato de
 * especie por frase, y la viñeta es más corta que la de siempre.
 */
const ESPECIE_DEL_DIARIO =
  "- Un hecho con el campo especie es un dato de una especie. Un solo dato de especie por frase, con el molde de su "
    + `etiqueta: ${textoDeMoldesDiario()} En [nombre], cite el id de su campo especie (no use el campo sujeto); en [dato], el `
    + "id del propio dato. Las dos referencias son distintas. La etiqueta ya trae «de la especie»: no la repita. Para otro dato "
    + "de la misma especie, abra otra frase con su molde. No use «misma» ni «mismo». El nombre de una especie nunca va solo en "
    + "una frase, y nunca cite el nombre de otra especie en ella.";

const REGLAS_DE_REDACCION_DIARIO = reglasDeRedaccion(NO_ESCRIBIR_OBLIGATORIOS, LARGO_DEL_DIARIO, ESPECIE_DEL_DIARIO);

const RESPUESTA = 'Responda solo con un JSON de esta forma: {"frases":[{"segmentos":[{"texto":"El valor de las acciones es"},'
  + '{"ref":"H01"},{"texto":"."}]}]}. Cada segmento tiene una sola clave: «texto» o «ref». La prosa va en los segmentos de '
  + "texto y cada dato, en un segmento de referencia con su id. Los ejemplos solo muestran la forma: el id H01 es de ejemplo; "
  + "use los ids, los datos y las etiquetas de los hechos que recibe.";

/** Una frase de ejemplo: las piezas son texto o, si son `null`, una referencia (el id H01 es solo de forma). */
const frase = (...piezas: (string | null)[]): string =>
  `{"segmentos":[${piezas.map((p) => (p === null ? '{"ref":"H01"}' : `{"texto":"${p}"}`)).join(",")}]}`;
const ejemplos = (...frases: string[]): string => frases.join("\n");

const armar = (tema: string, ejemplos: string, reglas: string = REGLAS_DE_REDACCION): string =>
  [`${PRESENTACION} ${tema}`, ENTRADA, reglas, `Ejemplos de frases correctas (solo la forma):\n${ejemplos}`, RESPUESTA].join("\n\n");

export const TEXTO_PROMPT_DIARIO = armar(
  "del día de un portafolio de inversiones: las ganancias sin vender, los dividendos y las comisiones, los cierres atrasados, "
    + "las especies, las tasas y el fondo. El sistema ya escribe los hechos obligatorios: usted escribe, con los demás hechos, "
    + "las frases que complementan el día. Cada frase lleva la referencia de su dato: un verbo como subió o bajó nunca "
    + "reemplaza la referencia.",
  ejemplos(
    frase("La ganancia sin vender es", null, "."),
    frase("Los dividendos recibidos son", null, ", y las comisiones pagadas son", null, "."),
    frase("Las especies sin precio son", null, ", y las especies con cierre atrasado son", null, "."),
    frase("La fecha del cierre más reciente es", null, "."),
    frase("El valor de la unidad del fondo es", null, "."),
    frase("El precio de cierre de la especie", null, "es", null, "."),
  ),
  REGLAS_DE_REDACCION_DIARIO,
);

export const TEXTO_PROMPT_REGLAS = armar(
  "del estado de las reglas del plan de un portafolio de inversión: qué regla está cerca de su nivel, cuál se tocó, los "
    + "plazos y los próximos dividendos. Las reglas no le dicen al lector qué hacer: no diga qué hacer con ellas. Cada regla tocada o cercana que sea obligatoria lleva su frase, con el nombre de su especie.",
  ejemplos(
    frase("La regla tocada de la especie", null, "es", null, "."),
    frase("La distancia al nivel de la regla de la especie", null, "es", null, "."),
    frase("La distancia al nivel de la regla de la especie", null, ", cerca del nivel, es", null, "."),
    frase("Los días que faltan para el plazo de la regla de la especie", null, "son", null, "."),
  ),
);

export const TEXTO_PROMPT_ESCENARIOS = armar(
  "de los escenarios de la proyección de un portafolio de inversiones: el bajo, el central y el alto en cada horizonte, lo "
    + "aportado, la probabilidad de terminar por debajo de lo aportado, la caída máxima y la volatilidad. Son escenarios "
    + "ilustrativos, no pronósticos: use el condicional (por ejemplo, «en el escenario central a corto plazo, el valor "
    + "quedaría en» y, enseguida, la referencia del dato) y nunca el futuro. Casi siempre son obligatorios el escenario central de los tres horizontes (corto, medio y largo) y la "
    + "probabilidad de terminar por debajo de lo aportado: escriba al menos cuatro frases: una por cada uno.",
  ejemplos(
    frase("El escenario central a corto plazo quedaría en", null, "."),
    frase("El escenario central a medio plazo quedaría en", null, "."),
    frase("El escenario central a largo plazo quedaría en", null, "."),
    frase("La probabilidad de terminar por debajo de lo aportado es", null, "."),
    frase("La caída máxima mediana sería", null, ", y la volatilidad anual histórica sería", null, "."),
  ),
);
