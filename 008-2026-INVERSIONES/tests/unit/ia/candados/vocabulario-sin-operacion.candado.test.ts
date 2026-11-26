/**
 * Candado estructural: la garantía de fondo contra «comprar/vender/mantener» es el vocabulario cerrado
 * (`vocabulario.ts`: una palabra de fuera rechaza la frase). Solo vale si NINGUNA palabra permitida tiene una raíz de
 * operación. Este candado lo comprueba sobre PALABRAS_BASE, CONDICIONALES y las etiquetas del catálogo de hoy.
 * Las raíces admiten el prefijo opcional «des» o «re» (desinvertir, recomprar).
 *
 * PENDIENTE (A5): extender este candado a las etiquetas de las claves de SIMULACION cuando entren al catálogo.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { plegarTildes } from "@/ia/validador/patron";
import { CONDICIONALES, PALABRAS_BASE, PALABRAS_SIMULACION, vocabularioDe } from "@/ia/validador/vocabulario";

const RAICES_DE_OPERACION = [
  "compr", "vend", "adquir", "invert", "inversion", "liquid", "incorpor", "aport", "retir", "aument", "reduc", "recort", "agreg", "añad",
  "increment", "disminu", "acumul", "duplic", "adicion", "rebalanc", "repond", "ampli", "deshac", "desprend", "negoci", "ejecut",
] as const;
const CON_RAIZ_DE_OPERACION = new RegExp(`^(?:des|re)?(?:${RAICES_DE_OPERACION.join("|")})`, "u");

const palabrasDe = (texto: string): readonly string[] => (texto.toLowerCase().match(/\p{L}+/gu) ?? []).map(plegarTildes);
export const conRaizDeOperacion = (palabras: readonly string[]): readonly string[] => palabras.filter((p) => CON_RAIZ_DE_OPERACION.test(p));

/**
 * EXCEPCIONES PENDIENTES DE DECISIÓN (de la Fábrica): palabras de las etiquetas de HOY que sí tienen una raíz de operación.
 * No se quitan de aquí. «vender» viene de «ganancia sin vender» y «rentabilidad sin vender de la especie»; «aportado», de
 * «lo aportado a corto, medio y largo plazo» y «probabilidad de terminar por debajo de lo aportado». Hoy las frena
 * RECOMENDACION.VENDER (salvo tras «sin») y, para SIMULACION, ATRIBUCION no dispara con «aportado». La prueba exige que
 * la lista sea exacta: si una desaparece o aparece otra, esta prueba da rojo.
 */
const EXCEPCIONES_PENDIENTES: readonly string[] = ["aportado", "vender"];

const ETIQUETAS_DE_HOY = TIPOS_DIARIOS.flatMap((tipo) => Object.values(CATALOGO[tipo]).map((entrada) => entrada.etiqueta));

describe("el vocabulario cerrado no tiene palabras con raíz de operación", () => {
  it("PALABRAS_BASE", () => {
    expect(conRaizDeOperacion(PALABRAS_BASE)).toEqual([]);
  });

  it("CONDICIONALES", () => {
    expect(conRaizDeOperacion(CONDICIONALES)).toEqual([]);
  });

  it("las etiquetas del catálogo de hoy (los tres tipos)", () => {
    expect(ETIQUETAS_DE_HOY.length).toBeGreaterThan(20);
    const halladas = conRaizDeOperacion(ETIQUETAS_DE_HOY.flatMap(palabrasDe));
    expect(halladas.filter((p) => !EXCEPCIONES_PENDIENTES.includes(p))).toEqual([]);
  });

  it("las excepciones pendientes son exactamente las que hay (ni de más ni de menos)", () => {
    expect([...new Set(conRaizDeOperacion(ETIQUETAS_DE_HOY.flatMap(palabrasDe)))].sort()).toEqual([...EXCEPCIONES_PENDIENTES]);
  });

  it("control positivo: plantar una palabra con raíz de operación en una lista da rojo", () => {
    for (const planta of ["comprar", "Vender", "reinvertir", "desinvertir", "recomprar", "adquirir", "incorporar", "aporte", "liquidez", "añadir", "rebalancear"]) {
      expect(conRaizDeOperacion([...PALABRAS_BASE, ...palabrasDe(planta)]), planta).toEqual([plegarTildes(planta.toLowerCase())]);
    }
    expect(conRaizDeOperacion(palabrasDe("el valor de comprar y de la venta"))).toEqual(["comprar"]);
  });

  it("control negativo: las palabras neutras no coinciden", () => {
    expect(conRaizDeOperacion(["suma", "queda", "peso", "alto", "riesgo", "entre", "para"])).toEqual([]);
  });
});

const RAICES_SIMULACION = ["cerr", "cierr", "pag", "recib", "tien", "tuv", "sum", "registr", "falt"] as const;
const CON_RAIZ_O_USTED_EN_SIMULACION = new RegExp(`^(?:des|re)?(?:${[...RAICES_DE_OPERACION, ...RAICES_SIMULACION].join("|")})|^usted$`, "u");
const conRaizEnSimulacion = (palabras: readonly string[]): readonly string[] => palabras.filter((p) => CON_RAIZ_O_USTED_EN_SIMULACION.test(p));
/** La única excepción que admite SIMULACION. */
const esExcepcionDeSimulacion = (palabra: string): boolean => /^aportad/u.test(palabra);

describe("SIMULACION: vocabulario y etiquetas sin raíces de operación ni de las evasiones", () => {
  const etiquetas = Object.values(CATALOGO.SIMULACION).map((e) => e.etiqueta);

  it("su vocabulario no tiene palabras con raíz de operación ni de cerr, cierr, pag, recib, tien, tuv, sum, ni «usted»", () => {
    const palabras = [...vocabularioDe("SIMULACION")];
    expect(palabras.length).toBeGreaterThan(50);
    expect(conRaizEnSimulacion(palabras).filter((p) => !esExcepcionDeSimulacion(p))).toEqual([]);
  });

  it("la lista explícita PALABRAS_SIMULACION no tiene ninguna raíz de operación ni de las evasiones (sin excepción alguna)", () => {
    expect(conRaizEnSimulacion(PALABRAS_SIMULACION)).toEqual([]);
  });

  it("sus etiquetas: solo «aportado» como excepción, nunca «vender», y ninguna dice «sin vender»", () => {
    const halladas = conRaizEnSimulacion(etiquetas.flatMap(palabrasDe));
    expect([...new Set(halladas)]).toEqual(["aportado"]);
    expect(halladas.every(esExcepcionDeSimulacion)).toBe(true);
    expect(etiquetas.join(" ").toLowerCase()).not.toMatch(/vend|sin vender/u);
  });

  it.each(["cerrar", "cierre", "pagar", "recibir", "tiene", "tuvo", "suma", "usted", "recompra", "registro", "registra", "falta", "faltan"])(
    "control positivo: plantar «%s» en una lista da rojo",
    (planta) => {
      expect(conRaizEnSimulacion([...vocabularioDe("SIMULACION"), planta]).filter((p) => !esExcepcionDeSimulacion(p))).toEqual([planta]);
    },
  );

  it("control positivo: «vender» planta rojo aunque «aportado» sea excepción", () => {
    expect(conRaizEnSimulacion(["vender"]).filter((p) => !esExcepcionDeSimulacion(p))).toEqual(["vender"]);
  });

  it("el vocabulario de los tres de hoy sí conserva esas palabras (por eso no se usa para SIMULACION)", () => {
    expect(conRaizEnSimulacion([...vocabularioDe("DIARIO")]).length).toBeGreaterThan(0);
  });
});
