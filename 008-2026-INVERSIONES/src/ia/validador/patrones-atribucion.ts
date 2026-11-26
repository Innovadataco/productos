/**
 * ATRIBUCION (condición C2 de PI): en SIMULACION la salida describe cómo queda el «después» y nunca atribuye el cambio
 * a una acción del lector («al aumentar la posición», «si compra», «tras la venta»). Piezas, con ids sin dígitos:
 * - CONECTOR_ACCION: un conector (causal, temporal, condicional o hipotético) y, dentro de sus 4 palabras siguientes, una
 *   acción. Una cita `{Hnn}` cuenta como una palabra: no sirve de puente para esconder la acción.
 * - OPERACION_NOMINAL: las raíces de operación sin ambigüedad (compr, vend, adquir, invert, liquid, incorpor, aport, retir,
 *   rebalanc, repond, con «des» o «re» delante) en cualquier posición y forma, sin conector (gerundio, pasiva, otro sujeto).
 * - AGENTE_USTED y AGENTE_OPERACION: «usted compra…», «la orden deja…» (el agente del cambio es el lector o la orden).
 * - COMPARA: «antes», «ya no», «deja de», «pasa de … a» (la comparación con el antes; «más que antes» queda cubierta por
 *   «antes»).
 *
 * LA GARANTÍA DE FONDO es el vocabulario cerrado (`vocabulario.ts`: una palabra de fuera rechaza la frase), siempre que
 * ninguna palabra permitida tenga una raíz de operación (lo cuida `candados/vocabulario-sin-operacion.candado.test.ts`).
 * ATRIBUCION es la capa de defensa adicional y no puede tumbar frases legítimas hechas con palabras permitidas: por eso las
 * raíces ambiguas («elev», «baj», «sub», «sum», «mov», «rot», «oper», «ampli», «reduc», «aument») van solo con la
 * desinencia verbal (nunca «elevado», «bajo», «subyacente», «sumamente», «operativo») y «aportado» fuera de «por debajo de lo aportado» (de una
 * etiqueta) queda fuera. El corpus dorado de `atribucion.test.ts` debe dar CERO coincidencias.
 *
 * DEPENDE DE QUE `CITA_PEGADA` rechace antes, en el orden del validador v4 (A7 lo prueba): la cita pegada a una palabra
 * («comprar{H01}») no la separa estos patrones.
 *
 * Todas corren sobre la forma PLEGADA (sin tildes): las listas se escriben sin ellas, salvo la ñ. Son listas negras: una
 * paráfrasis que no esté en ellas pasa (lo mitiga el vocabulario cerrado). No está conectada a `validarSalida`: eso es el
 * validador v4, solo SIMULACION. Cambiar una lista es otra versión del validador.
 */
import { patron, type Patron } from "./patron";

/** Los conectores que ligan un cambio con su causa, su momento, su condición o su hipótesis. */
export const CONECTORES_ATRIBUCION: readonly string[] = Object.freeze([
  "al", "tras", "con", "si", "cuando", "luego de", "despues de", "a raiz de", "debido a", "gracias a", "como resultado de", "en caso de",
  "para", "por", "ante", "mediante", "dado que", "segun", "siempre que", "mientras", "a medida que", "una vez(?: que)?", "apenas", "salvo que",
  "a menos que", "por causa de", "a consecuencia de", "por efecto de", "en funcion de", "bajo el supuesto de", "bajo la hipotesis de",
  "bajo el escenario de", "supongase que", "suponiendo que", "en el supuesto de", "hipoteticamente",
]);

const PREFIJO = "(?:des|re)?";
/**
 * «por debajo de lo» como palabras enteras y con el separador de `construirExpresion`: la ÚNICA frase donde «aportado» vale (la
 * etiqueta «probabilidad de quedar por debajo de lo aportado»). Fuera de ella, «lo aportado» («Con lo aportado», «Tras lo
 * aportado», «Lo aportado queda…») es atribución.
 */
const POR_DEBAJO_DE_LO = "(?<![\\p{L}\\p{N}])por[\\s,;:()«»]+debajo[\\s,;:()«»]+de[\\s,;:()«»]+lo[\\s,;:()«»]+";

/**
 * Las raíces de operación sin ambigüedad: en cualquier forma, con «des» o «re» delante. «comprobar» no, ni la frase exacta
 * «por debajo de lo aportado» (una etiqueta); sí «lo aportado» suelto, «se ha aportado», «aportada», «aportados» y «aporte». Incluye «invers» (inversión, inversor,
 * inversionista). La raíz `liquid` atrapa también «liquidez»: si una etiqueta de SIMULACION la usa, lo resuelve A5.
 */
export const OPERACIONES_SIN_AMBIGUEDAD: readonly string[] = Object.freeze([
  `${PREFIJO}compr(?!ob|ue|end|ens|om|im|esi|esor)\\p{L}*`, `${PREFIJO}vend\\p{L}*`, `${PREFIJO}adquir\\p{L}*`, `${PREFIJO}invert\\p{L}*`,
  `${PREFIJO}liquid\\p{L}*`, `${PREFIJO}incorpor\\p{L}*`, `(?!(?<=${POR_DEBAJO_DE_LO})aportado(?![\\p{L}\\p{N}]))${PREFIJO}aport\\p{L}*`, `${PREFIJO}retir\\p{L}*`,
  `${PREFIJO}rebalanc\\p{L}*`, `${PREFIJO}repond\\p{L}*`, `${PREFIJO}invers\\p{L}*`,
]);

/** Verbos de tenencia con una raíz poco ambigua (cualquier forma) o con la desinencia verbal explícita, y frases de entrar y salir. */
const OTRAS_ACCIONES: readonly string[] = [
  "recort\\p{L}*", "agreg\\p{L}*", "añad\\p{L}*", "increment\\p{L}*", "disminu\\p{L}*", "deshac\\p{L}*", "desprend\\p{L}*", "negoci\\p{L}*",
  "ejecut\\p{L}*", "acumul(?:ar|ando|an|en|aron)", "duplic(?:ar|ando|an|en|aron)", "adicion(?:ar|ando|an|en|aron)",
  // raíces ambiguas: solo con la desinencia verbal («elevado», «bajo», «subyacente», «sumamente», «operativo» no cuentan)
  "aument(?:ar(?:se)?|ando|a|an|e|en|o|aron)", "redu(?:c(?:ir(?:se)?|iendo|e|en|o|ieron)|zca|zcan)", "ampli(?:ar(?:se)?|ando|an|en|aron)",
  "elev(?:ar(?:se)?|ando|a|an|e|en|o|aron)", "baj(?:ar(?:se)?|ando|an|en|aron)", "sub(?:ir|iendo)", "sum(?:ar(?:se)?|ando)",
  "mov(?:er(?:se)?|iendo)", "rot(?:ar|ando)", "oper(?:ar|ando)",
  // «baja» y «suma» sueltas son otra cosa («marca la baja», «suma el valor»): solo reflexivas
  "se (?:baja|suma|sube|mueve|opera|rota|amplia)n?", "llev(?:ar|ando) mas", "(?:entrar|entrando|entrada) en", "(?:salir|saliendo|salida) de",
  "(?:aumentos?|reduccion(?:es)?|ampliacion(?:es)?) de",
];

/**
 * Las acciones verbales. «posición», «cantidad», «participación», «exposición» y «movimiento» no son acciones solos: solo
 * cuentan tras un verbo de acción o «aumento/reducción de», y esos ya son acciones.
 */
export const ACCIONES_VERBALES: readonly string[] = Object.freeze([...OPERACIONES_SIN_AMBIGUEDAD, ...OTRAS_ACCIONES]);

/** Sustantivos de la operación que cuentan con cualquier conector (singular y plural). */
export const SUSTANTIVOS_ACCION: readonly string[] = Object.freeze([
  "operacion(?:es)?", "orden(?:es)?", "transaccion(?:es)?", "compras?", "venta", "incorporacion(?:es)?", "aportes?", "entradas?",
  "adquisicion(?:es)?",
]);

/** «ventas» cuenta con todos los conectores menos «por» y «para» («ganancia por ventas» es una etiqueta de DIARIO). */
export const SUSTANTIVOS_SALVO_POR_PARA: readonly string[] = Object.freeze(["ventas"]);

/**
 * Lo que se opera: solo con un cuantificador delante («más acciones», «menos unidades») y nunca tras «por» ni «para»
 * («dividendo decretado por acción», «valor de las acciones», «valor de la unidad del fondo», «con una unidad» son etiquetas
 * o frases legítimas). Con un artículo solo no cuentan.
 */
export const SUSTANTIVOS_CON_CUANTIFICADOR: readonly string[] = Object.freeze(["accion(?:es)?", "unidad(?:es)?", "titulos?", "lotes?"]);
/** No cuenta si la palabra va justo después de «por» o «para» («ganancia por ventas», aunque un conector venga antes). */
const DETRAS_DE_POR_O_PARA = "(?<!(?<![\\p{L}\\p{N}])(?:por|para)[\\s,;:()«»]+)";
const CUANTIFICADORES = "(?:mas|menos|nuev[oa]s?)";
const CONECTORES_SIN_POR_NI_PARA = (conectores: readonly string[]): readonly string[] => conectores.filter((c) => c !== "por" && c !== "para");

/** Palabras entre el conector y la acción: la acción va en la cuarta palabra o antes. */
const MAX_PALABRAS_ANTES_DE_ACCION = 3;
/** Una palabra, o una cita `{Hnn}` (ya en minúsculas), seguida de su separador. */
const PALABRA = "(?:\\p{L}+|\\{h[0-9]{2}\\}) ";

const alternativas = (lista: readonly string[]): string => `(?:${lista.join("|")})`;

/**
 * CONECTOR_ACCION con las listas dadas (el candado por mutación la rearma sin un elemento). Sin conectores o sin ninguna
 * acción: RangeError. Las verbales y los sustantivos fuertes valen con todos los conectores; los otros dos grupos, con todos
 * menos «por» y «para».
 */
export function patronConectorAccion(
  conectores: readonly string[],
  verbales: readonly string[],
  sustantivos: readonly string[],
  salvoPorPara: readonly string[] = [],
  conCuantificador: readonly string[] = [],
  id = "ATRIBUCION.CONECTOR_ACCION",
): Patron {
  if (conectores.length === 0 || verbales.length + sustantivos.length + salvoPorPara.length + conCuantificador.length === 0) {
    throw new RangeError("ATRIBUCION necesita conectores y acciones.");
  }
  const rama = (cs: readonly string[], cola: string): string => `${alternativas(cs)} (?:${PALABRA}){0,${MAX_PALABRAS_ANTES_DE_ACCION}}${cola}`;
  const ramas: string[] = [];
  const fuertes = [...verbales, ...sustantivos];
  if (fuertes.length > 0) ramas.push(rama(conectores, alternativas(fuertes)));
  const sinPorPara = CONECTORES_SIN_POR_NI_PARA(conectores);
  if (sinPorPara.length > 0 && salvoPorPara.length > 0) ramas.push(rama(sinPorPara, `${DETRAS_DE_POR_O_PARA}${alternativas(salvoPorPara)}`));
  if (sinPorPara.length > 0 && conCuantificador.length > 0) {
    ramas.push(`${alternativas(sinPorPara)} (?:${PALABRA}){0,${MAX_PALABRAS_ANTES_DE_ACCION - 1}}${CUANTIFICADORES} ${alternativas(conCuantificador)}`);
  }
  if (ramas.length === 0) throw new RangeError("ATRIBUCION necesita conectores y acciones.");
  return patron(id, "PLEGADO", ramas);
}

/** OPERACION_NOMINAL con las raíces dadas. Sin raíces: RangeError. */
export function patronOperacionNominal(raices: readonly string[]): Patron {
  if (raices.length === 0) throw new RangeError("ATRIBUCION necesita raíces de operación.");
  return patron("ATRIBUCION.OPERACION_NOMINAL", "PLEGADO", [alternativas(raices)]);
}

/** Hasta 2 palabras entre el agente y su verbo («usted solo compra», «la orden lo deja»). */
const RELLENO_AGENTE = `(?:${PALABRA}){0,2}`;
const VERBOS_DE_LA_ORDEN = [
  "dej\\p{L}*", "llev\\p{L}*", "pone", "ponen", "puso", "pusieron", "poniendo", "cambi\\p{L}*", "sube", "suben", "baja", "bajan", "aumenta", "aumentan",
  "reduce", "reducen",
];

const ATRIBUCION: readonly Patron[] = [
  patronConectorAccion(CONECTORES_ATRIBUCION, ACCIONES_VERBALES, SUSTANTIVOS_ACCION, SUSTANTIVOS_SALVO_POR_PARA, SUSTANTIVOS_CON_CUANTIFICADOR),
  patronOperacionNominal(OPERACIONES_SIN_AMBIGUEDAD),
  patron("ATRIBUCION.AGENTE_USTED", "PLEGADO", [`usted ${RELLENO_AGENTE}${alternativas(ACCIONES_VERBALES)}`]),
  patron("ATRIBUCION.AGENTE_OPERACION", "PLEGADO", [`(?:la|una|su|esta|esa) (?:compra|venta|operacion|orden|simulacion) ${RELLENO_AGENTE}${alternativas(VERBOS_DE_LA_ORDEN)}`]),
  patron("ATRIBUCION.COMPARA", "PLEGADO", ["antes", "ya no", "dej(?:a|an) de", `pas(?:a|an) de (?:${PALABRA}){0,4}a`]),
];

export const PATRONES_ATRIBUCION: readonly Patron[] = Object.freeze(ATRIBUCION);

/**
 * Lo que el validador v4 le agrega SOLO a SIMULACION (ALTO-3): «usted» con cualquier verbo (basta que aparezca: el vocabulario
 * de SIMULACION ya no lo trae) y el sustantivo «cierre» o «cierres» después de un conector («Con el cierre de {H01}»).
 */
const SOLO_SIMULACION: readonly Patron[] = [
  patron("ATRIBUCION.USTED", "PLEGADO", ["usted(?:es)?"]),
  patronConectorAccion(CONECTORES_ATRIBUCION, [], ["cierres?"], [], [], "ATRIBUCION.CIERRE"),
];

/** Los patrones de ATRIBUCION que corre el validador v4 en SIMULACION (y solo en SIMULACION). */
export const PATRONES_ATRIBUCION_SIMULACION: readonly Patron[] = Object.freeze([...ATRIBUCION, ...SOLO_SIMULACION]);
