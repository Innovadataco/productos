/**
 * ATRIBUCION (condición C2 de PI): en SIMULACION la salida describe el «después» y nunca atribuye el cambio a una
 * acción. Piezas: conector + acción (hasta 4 palabras), la operación sin ambigüedad en cualquier posición
 * (OPERACION_NOMINAL), el agente («usted compra», «la orden deja…») y COMPARA («antes», «ya no», «deja de», «pasa de … a»);
 * más RECOMENDACION.ATENCION. Aquí no se conecta a `validarSalida` (eso es A7, solo para SIMULACION).
 *
 * Es una defensa adicional: la garantía de fondo es el vocabulario cerrado (ver el candado
 * `candados/vocabulario-sin-operacion.candado.test.ts`). Por eso, además de atrapar las atribuciones (con control positivo
 * y mutación), no puede tumbar las frases legítimas hechas con palabras permitidas: el corpus dorado de abajo da CERO.
 *
 * Nota: la raíz `liquid` atrapa también «liquidez»; si una etiqueta de SIMULACION la usa, A5 lo resuelve.
 * PENDIENTE (A5 y A7): extender el corpus dorado con las etiquetas de las claves de SIMULACION.
 */
import { describe, expect, it } from "vitest";
import { ETIQUETA_RANGO } from "@/analisis/puntos/etiquetas";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { construirExpresion, coincidencias, type Patron } from "@/ia/validador/patron";
import {
  ACCIONES_VERBALES,
  CONECTORES_ATRIBUCION,
  OPERACIONES_SIN_AMBIGUEDAD,
  PATRONES_ATRIBUCION,
  SUSTANTIVOS_ACCION,
  SUSTANTIVOS_CON_CUANTIFICADOR,
  SUSTANTIVOS_SALVO_POR_PARA,
  patronConectorAccion,
  patronOperacionNominal,
} from "@/ia/validador/patrones-atribucion";
import { PATRONES_ATENCION, PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { PALABRAS_SIMULACION } from "@/ia/validador/vocabulario";
import { crearPrng } from "@/proyecciones/prng";

const ids = (texto: string): readonly string[] => coincidencias(texto, PATRONES_ATRIBUCION);
const idsAtencion = (texto: string): readonly string[] => coincidencias(texto, PATRONES_ATENCION);
const LISTAS_DE_HOY: readonly Patron[] = [...PATRONES_RECOMENDACION, ...PATRONES_PREDICCION, ...PATRONES_TRATO];
const CONECTOR_ACCION = "ATRIBUCION.CONECTOR_ACCION";
const NOMINAL = "ATRIBUCION.OPERACION_NOMINAL";

const PREF = "(?:des|re)?";
/** «lo» como palabra entera y su separador: la única forma exenta de «aportado» (lo aportado, de una etiqueta). */
const LO = "(?<![\\p{L}\\p{N}])por[\\s,;:()«»]+debajo[\\s,;:()«»]+de[\\s,;:()«»]+lo[\\s,;:()«»]+";
/** Cada acción verbal (fragmento tal como está en `src/`) con una frase de ejemplo. El inventario es esta tabla. */
const EJEMPLO_VERBAL: Readonly<Record<string, string>> = {
  [`${PREF}compr(?!ob|ue|end|ens|om|im|esi|esor)\\p{L}*`]: "comprar",
  [`${PREF}vend\\p{L}*`]: "vender",
  [`${PREF}adquir\\p{L}*`]: "adquirir",
  [`${PREF}invert\\p{L}*`]: "invertir",
  [`${PREF}liquid\\p{L}*`]: "liquidar",
  [`${PREF}incorpor\\p{L}*`]: "incorporar",
  [`(?!(?<=${LO})aportado(?![\\p{L}\\p{N}]))${PREF}aport\\p{L}*`]: "aportar",
  [`${PREF}retir\\p{L}*`]: "retirar",
  [`${PREF}rebalanc\\p{L}*`]: "rebalancear",
  [`${PREF}repond\\p{L}*`]: "reponderar",
  [`${PREF}invers\\p{L}*`]: "inversión",
  "recort\\p{L}*": "recortar",
  "agreg\\p{L}*": "agregar",
  "añad\\p{L}*": "añadir",
  "increment\\p{L}*": "incrementar",
  "disminu\\p{L}*": "disminuir",
  "deshac\\p{L}*": "deshacer",
  "desprend\\p{L}*": "desprender",
  "negoci\\p{L}*": "negociar",
  "ejecut\\p{L}*": "ejecutar",
  "acumul(?:ar|ando|an|en|aron)": "acumular",
  "duplic(?:ar|ando|an|en|aron)": "duplicar",
  "adicion(?:ar|ando|an|en|aron)": "adicionar",
  "aument(?:ar(?:se)?|ando|a|an|e|en|o|aron)": "aumentar",
  "redu(?:c(?:ir(?:se)?|iendo|e|en|o|ieron)|zca|zcan)": "reducir",
  "ampli(?:ar(?:se)?|ando|an|en|aron)": "ampliar",
  "elev(?:ar(?:se)?|ando|a|an|e|en|o|aron)": "elevar",
  "baj(?:ar(?:se)?|ando|an|en|aron)": "bajar",
  "sub(?:ir|iendo)": "subir",
  "sum(?:ar(?:se)?|ando)": "sumar",
  "mov(?:er(?:se)?|iendo)": "mover",
  "rot(?:ar|ando)": "rotar",
  "oper(?:ar|ando)": "operar",
  "se (?:baja|suma|sube|mueve|opera|rota|amplia)n?": "se baja",
  "llev(?:ar|ando) mas": "llevar más",
  "(?:entrar|entrando|entrada) en": "entrar en",
  "(?:salir|saliendo|salida) de": "salir de",
  "(?:aumentos?|reduccion(?:es)?|ampliacion(?:es)?) de": "reducción de",
};
/** Cada sustantivo de la operación, con su ejemplo. */
const EJEMPLO_SUSTANTIVO: Readonly<Record<string, string>> = {
  "operacion(?:es)?": "operación", "orden(?:es)?": "orden", "transaccion(?:es)?": "transacción", "compras?": "compra", venta: "venta",
  "incorporacion(?:es)?": "incorporación", "aportes?": "aporte", "entradas?": "entrada", "adquisicion(?:es)?": "adquisición",
};
/** «ventas» cuenta con todos los conectores menos «por» y «para» (ganancia por ventas). */
const EJEMPLO_SALVO_POR_PARA: Readonly<Record<string, string>> = { ventas: "ventas" };
/** Cuentan solo con un cuantificador delante («más acciones», «menos unidades») y nunca tras «por» ni «para». */
const EJEMPLO_CON_CUANTIFICADOR: Readonly<Record<string, string>> = {
  "accion(?:es)?": "acciones", "unidad(?:es)?": "unidades", "titulos?": "títulos", "lotes?": "lotes",
};
/** Cada conector (fragmento) con su texto. */
const EJEMPLO_CONECTOR: Readonly<Record<string, string>> = {
  al: "al", tras: "tras", con: "con", si: "si", cuando: "cuando", "luego de": "luego de", "despues de": "después de", "a raiz de": "a raíz de",
  "debido a": "debido a", "gracias a": "gracias a", "como resultado de": "como resultado de", "en caso de": "en caso de",
  para: "para", por: "por", ante: "ante", mediante: "mediante", "dado que": "dado que", segun: "según", "siempre que": "siempre que",
  mientras: "mientras", "a medida que": "a medida que", "una vez(?: que)?": "una vez que", apenas: "apenas", "salvo que": "salvo que",
  "a menos que": "a menos que", "por causa de": "por causa de", "a consecuencia de": "a consecuencia de", "por efecto de": "por efecto de",
  "en funcion de": "en función de", "bajo el supuesto de": "bajo el supuesto de", "bajo la hipotesis de": "bajo la hipótesis de",
  "bajo el escenario de": "bajo el escenario de", "supongase que": "supóngase que", "suponiendo que": "suponiendo que",
  "en el supuesto de": "en el supuesto de", hipoteticamente: "hipotéticamente",
};
const VERBALES = Object.entries(EJEMPLO_VERBAL);
const SUSTANTIVOS = Object.entries(EJEMPLO_SUSTANTIVO);
const CONECTORES = Object.entries(EJEMPLO_CONECTOR);
const SALVO_POR_PARA = Object.entries(EJEMPLO_SALVO_POR_PARA);
const CON_CUANTIFICADOR = Object.entries(EJEMPLO_CON_CUANTIFICADOR);
const SIN_POR_PARA = CONECTORES.filter(([fragmento]) => fragmento !== "por" && fragmento !== "para");

describe("ATRIBUCION · inventario de las listas", () => {
  it("los conectores, las acciones y los sustantivos son exactamente los de la tabla", () => {
    expect([...CONECTORES_ATRIBUCION]).toEqual(Object.keys(EJEMPLO_CONECTOR));
    expect([...ACCIONES_VERBALES]).toEqual(Object.keys(EJEMPLO_VERBAL));
    expect([...SUSTANTIVOS_ACCION]).toEqual(Object.keys(EJEMPLO_SUSTANTIVO));
    expect([...SUSTANTIVOS_SALVO_POR_PARA]).toEqual(Object.keys(EJEMPLO_SALVO_POR_PARA));
    expect([...SUSTANTIVOS_CON_CUANTIFICADOR]).toEqual(Object.keys(EJEMPLO_CON_CUANTIFICADOR));
    expect([...OPERACIONES_SIN_AMBIGUEDAD]).toEqual(Object.keys(EJEMPLO_VERBAL).slice(0, 11));
  });

  it("los ids de los patrones y el orden son estables, sin dígitos", () => {
    expect(PATRONES_ATRIBUCION.map((p) => p.id)).toEqual([
      CONECTOR_ACCION, NOMINAL, "ATRIBUCION.AGENTE_USTED", "ATRIBUCION.AGENTE_OPERACION", "ATRIBUCION.COMPARA",
    ]);
    expect(Object.isFrozen(PATRONES_ATRIBUCION)).toBe(true);
    for (const p of PATRONES_ATRIBUCION) expect(p.id).not.toMatch(/[0-9]/u);
  });
});

describe("ATRIBUCION · conector + acción", () => {
  it.each(CONECTORES.flatMap(([, c]) => [...VERBALES, ...SUSTANTIVOS].map(([, a]) => [c, a] as const)))(
    "«%s %s» dispara el patrón (barrido de conector por acción)",
    (conector, accion) => {
      expect(ids(`${conector} ${accion}`)).toContain(CONECTOR_ACCION);
    },
  );

  it("«ventas» cuenta con los conectores menos «por» y «para»; con un cuantificador, acciones, unidades, títulos y lotes también", () => {
    for (const [, c] of SIN_POR_PARA) {
      expect(ids(`${c} las ventas`), c).toContain(CONECTOR_ACCION);
      for (const [, n] of CON_CUANTIFICADOR) {
        expect(ids(`${c} más ${n}`), `${c} más ${n}`).toContain(CONECTOR_ACCION);
        expect(ids(`${c} menos ${n}`), `${c} menos ${n}`).toContain(CONECTOR_ACCION);
        expect(ids(`${c} ${n}`), `${c} ${n}`).toEqual([]);
        expect(ids(`${c} las ${n}`), `${c} las ${n}`).toEqual([]);
        expect(ids(`${c} una ${n.replace(/s$/u, "")}`), `${c} una ${n}`).toEqual([]);
      }
    }
    for (const c of ["por", "para"]) {
      expect(ids(`${c} ventas`)).toEqual([]);
      for (const [, n] of CON_CUANTIFICADOR) {
        expect(ids(`${c} ${n}`)).toEqual([]);
        expect(ids(`${c} más ${n}`)).toEqual([]);
      }
    }
  });

  it("las etiquetas de hoy con estos sustantivos no disparan (falsos positivos del revisor)", () => {
    for (const frase of [
      "ganancia por ventas", "dividendo decretado por acción", "valor de las acciones", "valor de la unidad del fondo", "El valor por unidad",
      "Por acción", "Con una unidad", "Con la ganancia por ventas", "Si el dividendo decretado por acción",
    ]) {
      expect(ids(frase), frase).toEqual([]);
    }
  });

  it.each(["compró {H01}", "Compra {H01}", "vendió {H01}", "con la venta", "Tras la venta de {H01}", "Se compró {H01}", "Se vendió {H01}"])(
    "se atrapan «compró», «compra», «vendió» y «venta»: «%s»",
    (frase) => {
      expect(ids(frase).length, frase).toBeGreaterThan(0);
    },
  );
  it.each([
    "Al aumentar la posición, el peso de {H01} queda muy elevado.",
    "Al reducir la posición, la concentración baja.",
    "Si compra, el efecto sobre {H01} es fuerte.",
    "Tras la venta, el peso de {H01} queda leve.",
    "Al sumar más, la volatilidad {H02} queda alta.",
    "Al llevar más {H01}, la concentración queda alta.",
    "Después de recortar, {H01} queda moderado.",
    "Luego de ejecutar la orden, {H01} queda cerca.",
    "A raíz de la operación, {H01} queda en el nivel.",
    "Debido a la compra, {H01} queda fuerte.",
    "Gracias a la venta, {H01} queda leve.",
    "Como resultado de la operación, {H01} queda elevado.",
    "En caso de vender, {H01} queda leve.",
    "Cuando se agrega una acción, {H01} queda moderado.",
    "Para reducir el riesgo de {H01}, queda moderado.",
    "Mediante la venta de {H01}, queda leve.",
    "Suponiendo que se suma {H01}, queda elevado.",
    "Bajo el supuesto de comprar {H01}, queda elevado.",
    "Una vez que se baja {H01}, queda leve.",
    "En función de la orden, {H01} queda fuerte.",
    "Con el aumento de la posición, {H01} queda fuerte.",
    "Al entrar en {H01}, queda fuerte.",
    "Tras la salida de {H01}, queda leve.",
    "Si se suman más unidades de {H01}, queda fuerte.",
  ])("los casos de C2 y sus evasiones: «%s»", (frase) => {
    expect(ids(frase)).toContain(CONECTOR_ACCION);
  });

  it("los casos de C2 que no atrapa ninguna lista de hoy sí los atrapa ATRIBUCION; sin ella pasarían", () => {
    const casos = [
      "Al aumentar la posición, {H01} queda elevado.", "Al reducir la posición, {H01} queda leve.", "Al sumar más, {H01} queda moderado.",
      "Tras ejecutar la operación, {H01} queda fuerte.", "Al llevar más {H01}, queda fuerte.", "Para ampliar la tenencia, {H01} queda leve.",
    ];
    for (const caso of casos) {
      expect(coincidencias(caso, LISTAS_DE_HOY), caso).toEqual([]);
      expect(ids(caso).length, caso).toBeGreaterThan(0);
    }
  });

  it("la acción puede ir hasta en la cuarta palabra; en la quinta ya no cuenta", () => {
    expect(ids("con el peso {H01} subir")).toContain(CONECTOR_ACCION);
    expect(ids("con el peso total {H01} subir")).not.toContain(CONECTOR_ACCION);
    expect(ids("tras la venta")).toContain(CONECTOR_ACCION);
    expect(ids("tras todo lo que se dice sobre la orden")).not.toContain(CONECTOR_ACCION);
  });

  it("no la esconden las mayúsculas, las tildes, los espacios raros ni los caracteres invisibles", () => {
    expect(ids("TRAS LA ORDEN")).toContain(CONECTOR_ACCION);
    expect(ids("Después   de ejecutar")).toContain(CONECTOR_ACCION);
    expect(ids("A​ raíz de la orden")).toContain(CONECTOR_ACCION);
    expect(ids("Al añadir acciones")).toContain(CONECTOR_ACCION);
    expect(ids("Al aumentar")).toContain(CONECTOR_ACCION);
  });

  it("la cita {Hnn} cuenta como una palabra: no sirve de puente para esconder la acción", () => {
    expect(ids("Si {H03} se reduce")).toContain(CONECTOR_ACCION);
    expect(ids("Con {H03} {H04} {H05} vender")).toContain(CONECTOR_ACCION);
  });

  it("solo con la desinencia verbal: los adjetivos y sustantivos de la misma raíz no cuentan (falsos positivos del revisor)", () => {
    for (const frase of [
      "Con el peso muy elevado",
      "Si el riesgo es elevado",
      "Si el peso es bajo",
      "Con la concentración baja",
      "Con {H01} queda elevado el peso",
      "Si la concentración es elevada, {H01} queda moderado.",
      "Con el activo subyacente",
      "Con un riesgo sumamente alto",
      "Con un perfil operativo",
      "Si la suma es alta",
      "Cuando la rotación es alta",
      "Con el peso elevada",
      "Si el movimiento es grande",
    ]) {
      expect(ids(frase), frase).toEqual([]);
    }
  });

  it("«posición», «cantidad», «participación», «exposición» y «movimiento» solos no cuentan; con un verbo de acción o «aumento de» sí", () => {
    for (const frase of ["con la posición", "si la cantidad es alta", "con la participación", "cuando la exposición es alta", "tras el movimiento"]) {
      expect(ids(frase), frase).toEqual([]);
    }
    for (const frase of ["con el aumento de la posición", "al reducir la exposición", "si se suma la cantidad", "al aumentar las cantidades", "tras ampliar la participación"]) {
      expect(ids(frase), frase).toContain(CONECTOR_ACCION);
    }
  });

  it("«aportado» solo vale dentro de la frase exacta «por debajo de lo aportado»; fuera de ella, «lo aportado» y todo el resto se atrapa", () => {
    for (const frase of [
      "La probabilidad de quedar por debajo de lo aportado queda elevada", "por debajo de lo aportado", "Con la probabilidad de quedar por debajo de lo aportado",
      "por  debajo de lo aportado", "Por debajo, de lo aportado",
    ]) {
      expect(ids(frase), frase).toEqual([]);
    }
    for (const frase of [
      "Con lo aportado {H01}", "Tras lo aportado", "Si lo aportado queda moderado", "Lo aportado queda moderado", "lo aportado a corto plazo", "Debajo de lo aportado",
      "Si se hubiese aportado {H01}", "si ya se habia aportado {H01}", "Con aportada {H01}", "aportada {H01} sube", "se ha aportado {H01}", "Con aportados {H01}",
      "con el aporte", "al aportar", "aportado {H01}", "Con lo aportados {H01}", "Se aportó {H01}", "Para por debajo de lo aportado y aportado",
    ]) {
      expect(ids(frase).length, frase).toBeGreaterThan(0);
    }
  });

  it("«inversión», «inversor» e «inversionista» se atrapan en cualquier posición", () => {
    for (const frase of ["La inversión de {H01}", "El inversor {H01}", "El inversionista {H01}", "Reinversión de {H01}"]) {
      expect(ids(frase), frase).toContain(NOMINAL);
    }
  });

  it("las palabras son completas: «alto» no es el conector «al»; «sin» no es conector", () => {
    expect(ids("alto aumentar")).not.toContain(CONECTOR_ACCION);
    expect(ids("sin ordenar")).not.toContain(CONECTOR_ACCION);
  });

  it.each(CONECTORES)("mutación por conector: sin «%s», su frase (la acción en la cuarta palabra) ya no dispara", (fragmento, texto) => {
    const frase = `${texto} el peso total comprar`;
    const todos = patronConectorAccion(CONECTORES_ATRIBUCION, ACCIONES_VERBALES, SUSTANTIVOS_ACCION);
    const sin = patronConectorAccion(CONECTORES_ATRIBUCION.filter((c) => c !== fragmento), ACCIONES_VERBALES, SUSTANTIVOS_ACCION);
    expect(coincidencias(frase, [todos]), texto).toEqual([CONECTOR_ACCION]);
    expect(coincidencias(frase, [sin]), texto).toEqual([]);
  });

  it.each(VERBALES)("mutación por acción verbal (sola, sin sustantivos): con «%s» detecta «%s» y sin ella no", (fragmento, palabra) => {
    const con = patronConectorAccion(CONECTORES_ATRIBUCION, [fragmento], []);
    const sin = patronConectorAccion(CONECTORES_ATRIBUCION, ACCIONES_VERBALES.filter((r) => r !== fragmento), []);
    expect(coincidencias(`al ${palabra}`, [con])).toEqual([CONECTOR_ACCION]);
    expect(coincidencias(`al ${palabra}`, [sin]), palabra).toEqual([]);
  });

  it.each(SUSTANTIVOS)("mutación por sustantivo (solo, sin verbos): con «%s» detecta «%s» y sin él no", (fragmento, palabra) => {
    const con = patronConectorAccion(CONECTORES_ATRIBUCION, [], [fragmento]);
    const sin = patronConectorAccion(CONECTORES_ATRIBUCION, [], SUSTANTIVOS_ACCION.filter((s) => s !== fragmento));
    expect(coincidencias(`tras la ${palabra}`, [con])).toEqual([CONECTOR_ACCION]);
    expect(coincidencias(`tras la ${palabra}`, [sin]), palabra).toEqual([]);
  });

  it.each(SALVO_POR_PARA)("mutación por sustantivo «%s» (salvo tras por y para): con él detecta y sin él no", (fragmento, palabra) => {
    const con = patronConectorAccion(CONECTORES_ATRIBUCION, [], [], [fragmento], []);
    const sin = patronConectorAccion(CONECTORES_ATRIBUCION, [], SUSTANTIVOS_ACCION, [], []);
    expect(coincidencias(`tras las ${palabra}`, [con])).toEqual([CONECTOR_ACCION]);
    expect(coincidencias(`tras las ${palabra}`, [sin])).toEqual([]);
  });

  it.each(CON_CUANTIFICADOR)("mutación por sustantivo «%s» (con cuantificador): con él detecta y sin él no", (fragmento, palabra) => {
    const con = patronConectorAccion(CONECTORES_ATRIBUCION, [], [], [], [fragmento]);
    const sin = patronConectorAccion(CONECTORES_ATRIBUCION, [], [], [], SUSTANTIVOS_CON_CUANTIFICADOR.filter((n) => n !== fragmento).concat(["otra"]));
    expect(coincidencias(`con más ${palabra}`, [con])).toEqual([CONECTOR_ACCION]);
    expect(coincidencias(`con más ${palabra}`, [sin])).toEqual([]);
  });

  it("los plurales de los sustantivos también cuentan", () => {
    for (const frase of ["tras las operaciones", "tras las órdenes", "con las compras", "tras las ventas", "con más lotes", "con más títulos", "tras más acciones"]) {
      expect(ids(frase), frase).toContain(CONECTOR_ACCION);
    }
  });

  it("un patrón sin conectores o sin acciones es un defecto del código (RangeError)", () => {
    expect(() => patronConectorAccion([], ACCIONES_VERBALES, SUSTANTIVOS_ACCION)).toThrow(RangeError);
    expect(() => patronConectorAccion(CONECTORES_ATRIBUCION, [], [])).toThrow(RangeError);
    expect(() => patronConectorAccion(CONECTORES_ATRIBUCION, ACCIONES_VERBALES, [])).not.toThrow();
    expect(() => patronConectorAccion(CONECTORES_ATRIBUCION, [], SUSTANTIVOS_ACCION)).not.toThrow();
    expect(() => patronOperacionNominal([])).toThrow(RangeError);
  });
});

describe("ATRIBUCION.OPERACION_NOMINAL · la operación sin ambigüedad, en cualquier posición y sin conector", () => {
  it.each([
    "Comprando {H01}", "Se compra {H01}", "El inversionista compra {H01}", "{H01} se vende", "Reinvertir {H01}", "Recomprar {H01}",
    "Revender {H01}", "Desinvertir en {H01}", "Readquirir {H01}", "El aporte de {H01}", "Retirar {H01}", "Rebalancear {H01}",
    "Reponderar {H01}", "Liquidando {H01}", "Incorporar {H01}", "Adquirir {H01}", "Se aportan {H01}", "Vendiendo {H01}",
  ])("«%s»", (frase) => {
    expect(ids(frase)).toContain(NOMINAL);
  });

  it("no atrapa las palabras que solo empiezan igual (comprobar, comprender, compromiso) ni «lo aportado»", () => {
    for (const frase of ["Se comprueba {H01}", "Se comprende {H01}", "El compromiso de {H01}", "Compresión de {H01}"]) {
      expect(ids(frase), frase).not.toContain(NOMINAL);
    }
  });

  it.each(Object.entries(EJEMPLO_VERBAL).slice(0, 11))("mutación por raíz: sin «%s», «%s» ya no se detecta", (fragmento, palabra) => {
    const sin = patronOperacionNominal(OPERACIONES_SIN_AMBIGUEDAD.filter((r) => r !== fragmento));
    expect(coincidencias(palabra, [patronOperacionNominal(OPERACIONES_SIN_AMBIGUEDAD)])).toEqual([NOMINAL]);
    expect(coincidencias(palabra, [sin]), palabra).toEqual([]);
  });
});

describe("ATRIBUCION · agente", () => {
  it.each([
    "usted compra {H01}", "Usted vende {H01}", "usted aumenta el peso", "usted solo reduce {H01}", "usted ya agregó acciones", "usted ya ejecuta",
  ])("«%s» dispara AGENTE_USTED", (frase) => {
    expect(ids(frase)).toContain("ATRIBUCION.AGENTE_USTED");
  });

  it.each([
    "la operación deja {H01} elevado", "La orden lleva {H01} a un rango fuerte", "la simulación pone {H01} en el nivel",
    "La operación cambia {H01}", "la orden lo deja en un rango alto", "la compra deja {H01} elevado", "una venta lleva {H01} a otro rango",
    "su orden sube {H01}", "esta operación aumenta {H01}", "esa simulación reduce {H01}", "la orden baja {H01}", "su compra pone {H01} fuerte",
  ])("«%s» dispara AGENTE_OPERACION", (frase) => {
    expect(ids(frase)).toContain("ATRIBUCION.AGENTE_OPERACION");
  });

  it("control positivo: «usted» sin acción y «la operación» sin verbo de efecto no disparan AGENTE", () => {
    for (const frase of ["Usted tiene {H01} en un rango fuerte.", "La simulación muestra {H01} elevado.", "La orden queda registrada."]) {
      expect(ids(frase).filter((i) => i.startsWith("ATRIBUCION.AGENTE")), frase).toEqual([]);
    }
  });

  it.each(["usted ejecuta", "usted aumenta", "la operación deja", "la orden lleva", "la simulación pone", "la operación cambia", "su orden sube"])(
    "mutación: «%s» se detecta solo con el patrón de agente",
    (frase) => {
      const sinAgente = PATRONES_ATRIBUCION.filter((p) => !p.id.startsWith("ATRIBUCION.AGENTE"));
      expect(coincidencias(frase, sinAgente), frase).toEqual([]);
      expect(ids(frase).length).toBeGreaterThan(0);
    },
  );
});

describe("ATRIBUCION.COMPARA", () => {
  it.each([
    ["antes", "Antes el peso era menor."],
    ["ya no", "{H01} ya no está elevado."],
    ["deja de", "{H01} deja de ser leve."],
    ["pasa de … a", "{H01} pasa de leve a fuerte."],
    ["pasa de … a (con citas)", "{H01} pasa de {H02} a {H03}."],
    ["más que antes", "Pesa más que antes."],
  ])("«%s»: «%s»", (_caso, frase) => {
    expect(ids(frase)).toContain("ATRIBUCION.COMPARA");
  });

  it("control positivo: una frase descriptiva sin comparación no dispara COMPARA", () => {
    expect(ids("El peso de {H01} queda muy elevado, y {H02} pasa a ser mayoritario.")).not.toContain("ATRIBUCION.COMPARA");
    expect(ids("El peso de {H01} queda muy elevado.")).not.toContain("ATRIBUCION.COMPARA");
  });

  it.each([
    ["antes", "antes"],
    ["ya no", "ya no"],
    ["dej(?:a|an) de", "deja de"],
    ["pas(?:a|an) de", "pasa de {H01} a {H02}"],
  ])("mutación por alternativa: sin la de «%s», «%s» ya no se detecta", (cabeza, ejemplo) => {
    const compara = PATRONES_ATRIBUCION.find((p) => p.id === "ATRIBUCION.COMPARA") as Patron;
    const indice = compara.alternativas.findIndex((a) => a.startsWith(cabeza));
    expect(indice, cabeza).toBeGreaterThanOrEqual(0);
    const sin = construirExpresion(compara.alternativas.filter((_a, j) => j !== indice), compara.antes);
    expect(sin.test(ejemplo.toLowerCase()), ejemplo).toBe(false);
    expect(compara.patron.test(ejemplo.toLowerCase()), ejemplo).toBe(true);
  });
});

/** Las palabras de rango del paso 1 (ETIQUETA_RANGO) y las de las etiquetas que hablan de lo aportado. */
const RANGOS = [
  ...new Set([...Object.values(ETIQUETA_RANGO).flatMap((porRango) => Object.values(porRango) as string[]), "por debajo de lo aportado", "en rango"]),
];
/**
 * Las etiquetas del corpus: las de los cuatro tipos, salvo las que SIMULACION no usa y que contienen una raíz de operación
 * («ganancia sin vender», «rentabilidad sin vender…») o «lo aportado» fuera de la frase exacta «por debajo de lo aportado».
 */
const ETIQUETAS_FUERA_DEL_CORPUS = /vender|(?<!por debajo de )lo aportado/u;
const ETIQUETAS_DE_HOY = TIPOS_RESUMEN.flatMap((tipo) => Object.values(CATALOGO[tipo]).map((e) => e.etiqueta.toLowerCase())).filter((e) => !ETIQUETAS_FUERA_DEL_CORPUS.test(e));
const PALABRAS_DE_ETIQUETAS = [...new Set(ETIQUETAS_DE_HOY.flatMap((e) => e.match(/\p{L}+/gu) ?? []))].filter((w) => w !== "aportado" && w !== "ventas");
// «ventas» sola tras un conector («tras ventas») sí es atribución: de esa etiqueta solo se prueba la frase entera («ganancia por ventas»).
/** Las palabras explícitas de SIMULACION (su lista permitida), no PALABRAS_BASE. */
const FUNCIONALES = [...PALABRAS_SIMULACION];
/** Todas las palabras del corpus: las funcionales, las de las etiquetas de los 3 tipos y las de rango. */
const UNIVERSO = [...new Set([...FUNCIONALES, ...PALABRAS_DE_ETIQUETAS, ...RANGOS.flatMap((r) => r.match(/\p{L}+/gu) ?? [])])].filter((w) => w !== "aportado" && !/^(?:accion(?:es)?|unidad(?:es)?|titulos?|lotes?)$/u.test(w.normalize("NFD").replace(/\p{M}/gu, "")));
// «más acciones» es atribución por diseño: de esas etiquetas solo se prueban las frases enteras («valor de las acciones»).
const TEXTO_CONECTORES = CONECTORES_ATRIBUCION.map((fragmento) => EJEMPLO_CONECTOR[fragmento] as string);

describe("corpus dorado · las frases válidas del «después» dan CERO coincidencias de ATRIBUCION", () => {
  it("las palabras de rango del paso 1 son las que se esperan (si cambian, hay que revisar este corpus)", () => {
    expect(RANGOS).toEqual(expect.arrayContaining([
      "elevado", "muy elevado", "moderada", "elevada", "mediano", "grande", "intermedia", "tocada", "en su nivel",
      "mayor que su peso", "mucho mayor que su peso", "muy cerca de su nivel", "cerca de su nivel", "a poca distancia de su nivel",
    ]));
  });

  it("los ejemplos reales del revisor", () => {
    for (const frase of [
      "Con el peso muy elevado", "Si el riesgo es elevado", "Si el peso es bajo", "Con la concentración baja", "Con {H01} queda elevado el peso",
      "Si la concentración es elevada, {H01} queda moderado.", "El peso de {H01} queda muy elevado.",
    ]) {
      expect(ids(frase), frase).toEqual([]);
    }
  });

  it("el universo cubre PALABRAS_SIMULACION, las etiquetas y los rangos; los 36 conectores están", () => {
    expect(TEXTO_CONECTORES).toHaveLength(36);
    expect(ETIQUETAS_DE_HOY.length).toBeGreaterThan(50);
    expect(UNIVERSO.length).toBeGreaterThan(100);
    for (const palabra of ["peso", "riesgo", "elevado", "queda"]) expect(UNIVERSO, palabra).toContain(palabra);
    // El corpus incluye las etiquetas de SIMULACION (A5), solas y tras cada conector (las prueba el test de las etiquetas).
    for (const entrada of Object.values(CATALOGO.SIMULACION)) expect(ETIQUETAS_DE_HOY, entrada.etiqueta).toContain(entrada.etiqueta.toLowerCase());
  });

  it("TODAS las etiquetas de hoy (los tres catálogos), solas y detrás de cada uno de los 36 conectores, con y sin cita", () => {
    for (const etiqueta of ETIQUETAS_DE_HOY) {
      expect(ids(etiqueta), etiqueta).toEqual([]);
      for (const conector of TEXTO_CONECTORES) {
        for (const frase of [`${conector} ${etiqueta}`, `${conector} el ${etiqueta} de {H01}`, `${conector} {H01} ${etiqueta}`]) {
          expect(ids(frase), frase).toEqual([]);
        }
      }
    }
  });

  it("cada palabra permitida, sola y tras cada conector", () => {
    for (const palabra of UNIVERSO) {
      expect(ids(palabra), palabra).toEqual([]);
      for (const conector of TEXTO_CONECTORES) expect(ids(`${conector} ${palabra}`), `${conector} ${palabra}`).toEqual([]);
    }
  });

  it("los 36 conectores × cada palabra del universo, con 0 a 3 palabras de relleno (muestreo con semilla) y un caso con la cita", () => {
    const prng = crearPrng(90211);
    const sujetos = ["el peso de {H01}", "la concentración", "la contribución de {H01} al riesgo", "el efecto de una caída de {H01} en el portafolio", "la regla de {H01}"];
    let probadas = 0;
    for (const conector of TEXTO_CONECTORES) {
      for (const palabra of UNIVERSO) {
        const k = prng.enteroMenorQue(4);
        const relleno = Array.from({ length: k }, () => UNIVERSO[prng.enteroMenorQue(UNIVERSO.length)]).join(" ");
        const sujeto = sujetos[prng.enteroMenorQue(sujetos.length)];
        for (const frase of [`${conector} ${relleno} ${palabra}`, `${conector} {H01} ${palabra}`, `${conector} ${sujeto} queda ${palabra}`]) {
          expect(ids(frase), frase).toEqual([]);
          probadas += 1;
        }
      }
    }
    expect(probadas).toBeGreaterThan(12000);
  });

  it("los 36 conectores a 0, 1, 2 y 3 palabras, antes de cada palabra de rango", () => {
    const prng = crearPrng(41377);
    for (const conector of TEXTO_CONECTORES) {
      for (const k of [0, 1, 2, 3]) {
        for (const rango of RANGOS) {
          const relleno = Array.from({ length: k }, () => FUNCIONALES[prng.enteroMenorQue(FUNCIONALES.length)]).join(" ");
          for (const frase of [`${conector} ${relleno} ${rango}`, `${conector} {H01} ${relleno} ${rango}`]) expect(ids(frase), frase).toEqual([]);
        }
      }
    }
  });

  it("las plantillas del paso 1 (fraseDelCambio) con cada palabra de rango no disparan", () => {
    for (const rango of RANGOS) {
      for (const frase of [
        `El peso de {H01} pasa a ser ${rango}`, `La concentración del portafolio (HHI) pasa a ser ${rango}`,
        `La contribución de {H01} al riesgo pasa a ser ${rango}`, `El efecto de una caída de {H01} en el portafolio pasa a ser ${rango}`,
        "La probabilidad de quedar por debajo de lo aportado pasa a ser " + rango, `Con el precio límite de la orden, la regla de {H01} queda ${rango}`,
      ]) {
        // «pasa a ser» no es «pasa de … a»; la plantilla de la lista del paso 1 tampoco se manda a la IA (solo el después).
        expect(ids(frase).filter((i) => i !== "ATRIBUCION.AGENTE_OPERACION"), frase).toEqual([]);
      }
    }
  });
});

describe("RECOMENDACION.ATENCION", () => {
  it.each([
    "atención", "Atento", "fíjese", "mire", "ojo", "cuidado", "preste", "observe", "tenga presente", "revise", "considere", "vigile",
    "tome nota", "no pase por alto", "conviene", "vale la pena",
  ])("«%s» dispara RECOMENDACION.ATENCION", (palabra) => {
    expect(idsAtencion(`${palabra} con {H01}`)).toEqual(["RECOMENDACION.ATENCION"]);
  });

  it("control positivo: una descripción neutra no dispara", () => {
    expect(idsAtencion("El peso de {H01} queda muy elevado.")).toEqual([]);
    expect(idsAtencion("La observación de {H01} queda moderada.")).toEqual([]);
  });

  it("mutación: cada palabra sale de la lista y deja de detectarse", () => {
    const patron = PATRONES_ATENCION[0] as Patron;
    expect(patron.id).toBe("RECOMENDACION.ATENCION");
    for (const alternativa of patron.alternativas) {
      const sin = construirExpresion(patron.alternativas.filter((a) => a !== alternativa), patron.antes);
      expect(sin.test(alternativa), alternativa).toBe(false);
    }
  });

  it("no se agrega a PATRONES_RECOMENDACION: cambiar esa lista cambiaría la huella y la conducta de hoy (es A7, validador-v4)", () => {
    expect(PATRONES_RECOMENDACION.map((p) => p.id)).not.toContain("RECOMENDACION.ATENCION");
  });
});
