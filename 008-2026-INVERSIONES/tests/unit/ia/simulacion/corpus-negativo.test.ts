/**
 * Corpus negativo de SIMULACION: las evasiones que demostró el revisor de seguridad, con el código que las rechaza. Cada una
 * lleva la misma estructura de la frase buena (que publica: control positivo), así que lo que la tumba es SOLO la palabra o la
 * expresión de la evasión. Corren con el validador real (vocabulario cerrado, ATRIBUCION y el resto).
 */
import { describe, expect, it } from "vitest";
import { construirPaquete } from "@/ia/paquete";
import { segmentosDe } from "@/ia/validador/segmentos";
import { validarSalida } from "@/ia/validador/validar";
import { entradaSimulacion } from "../apoyo/hechos.ficticio";
import { frase } from "../validador/apoyo/salidas.ficticio";

const paquete = construirPaquete(entradaSimulacion());
const RESTO = [
  "La contribución de la especie {ESPECIE_NOMBRE} al riesgo queda en {PUNTO_CONTRIBUCION_RIESGO}, mucho mayor que su peso.",
  "La cercanía al nivel de la regla de la especie {ESPECIE_NOMBRE} queda en {PUNTO_NIVEL_REGLA}, muy cerca de su nivel.",
];
const salida = (primera: string): string =>
  JSON.stringify({ frases: [primera, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] });
const motivos = (primera: string): readonly string[] => {
  const r = validarSalida(salida(primera), paquete);
  return r.ok ? [] : r.motivos;
};

const BUENA = "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.";

const NEGATIVOS: readonly (readonly [string, string, readonly string[]])[] = [
  ["Sin la especie…", "Sin la especie {ESPECIE_NOMBRE} el peso de la especie queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["Con lo aportado…", "Con lo aportado {ESPECIE_NOMBRE}, el peso de la especie queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA", "ATRIBUCION"]],
  ["Tras lo aportado…", "Tras lo aportado, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA", "ATRIBUCION"]],
  ["«lo aportado» fuera de su etiqueta, con palabras permitidas", "Lo aportado: el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.", ["ATRIBUCION"]],
  ["Tras el registro…", "Tras el registro, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["Con el registro de la especie…", "Con el registro de la especie {ESPECIE_NOMBRE}, el peso queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["Cuando falta la especie…", "Cuando falta la especie {ESPECIE_NOMBRE}, el peso de la especie queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["…no es muy elevado (invierte el rango)", "El peso de la especie {ESPECIE_NOMBRE} no es muy elevado en {PESO_ESPECIE}.", ["IDIOMA"]],
  ["…no queda en (invierte el rango)", "El peso de la especie {ESPECIE_NOMBRE} no queda en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["…queda todavía en…", "El peso de la especie {ESPECIE_NOMBRE} queda todavía en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["…queda aún en…", "El peso de la especie {ESPECIE_NOMBRE} queda aún en {PESO_ESPECIE}, muy elevado.", ["IDIOMA"]],
  ["Si usted cierra…", "Si usted cierra {PESO_ESPECIE}, el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.", ["IDIOMA", "ATRIBUCION"]],
  ["Usted paga…", "Usted paga {PESO_ESPECIE}, y el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.", ["IDIOMA", "ATRIBUCION"]],
  ["una etiqueta afirmada sobre otro hecho (1)", "El peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado, al nivel de la regla.", ["ETIQUETA_NO_COINCIDE"]],
  ["una etiqueta afirmada sobre otro hecho (2)", "El peso de la especie {ESPECIE_NOMBRE} es el nivel de la regla en {PESO_ESPECIE}, muy elevado.", ["ETIQUETA_NO_COINCIDE"]],
  ["Con el cierre de…", "Con el cierre de {PESO_ESPECIE}, el peso de la especie {ESPECIE_NOMBRE} queda muy elevado.", ["IDIOMA", "ATRIBUCION"]],
];

describe("corpus negativo de SIMULACION", () => {
  it("control positivo: la frase buena, con la misma estructura, PUBLICA", () => {
    expect(validarSalida(salida(BUENA), paquete).ok).toBe(true);
  });

  it("control positivo del «aportado» legítimo: la etiqueta exacta «por debajo de lo aportado» publica", () => {
    const conProbabilidad = "La probabilidad de quedar por debajo de lo aportado queda en {PROBABILIDAD_BAJO_APORTADO}, elevada.";
    const r = validarSalida(JSON.stringify({ frases: [BUENA, conProbabilidad, ...RESTO].map((p) => ({ segmentos: segmentosDe(frase(paquete, p).texto) })), revisar: [] }), paquete);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it.each(NEGATIVOS)("%s da RECHAZADO con el código esperado", (_caso, plantilla, esperados) => {
    const dados = motivos(plantilla);
    expect(dados.length, "debía rechazarse").toBeGreaterThan(0);
    for (const codigo of esperados) expect(dados, `${plantilla} → ${dados.join(",")}`).toContain(codigo);
  });

  /**
   * VIGILANCIA. «Al quedar…» y «Por el riesgo…» no son atribución (no hay una acción), pero abren una puerta si el vocabulario
   * crece: hoy las rechaza ETIQUETA.SIN_HECHO («quedar» y «riesgo» son palabras de la etiqueta de otro punto, sin su hecho).
   * Si una versión futura cambia eso, esta prueba avisa.
   */
  it.each([
    ["Al quedar…", "Al quedar el peso de la especie {ESPECIE_NOMBRE} en {PESO_ESPECIE}, muy elevado."],
    ["Por el riesgo…", "Por el riesgo, el peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado."],
  ])("vigilancia: «%s» se rechaza hoy por ETIQUETA.SIN_HECHO (no por ATRIBUCION)", (_caso, plantilla) => {
    const r = validarSalida(salida(plantilla), paquete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hallazgos.map((h) => h.patron)).toContain("ETIQUETA.SIN_HECHO");
    expect(r.motivos).not.toContain("ATRIBUCION");
  });

  /**
   * VIGILANCIA: «Al peso de la especie…» PUBLICA hoy. No es atribución (no nombra ninguna acción; «al» solo viene de las
   * etiquetas y la frase describe el peso). Se deja escrito para que, si una versión futura del vocabulario abre una palabra
   * de acción, esta aserción avise de que algo cambió.
   */
  it("vigilancia: «Al peso de la especie…» PUBLICA hoy (no es atribución)", () => {
    expect(validarSalida(salida("Al peso de la especie {ESPECIE_NOMBRE} queda en {PESO_ESPECIE}, muy elevado."), paquete).ok).toBe(true);
    expect(validarSalida(salida("Al peso de la especie {ESPECIE_NOMBRE} en {PESO_ESPECIE}, muy elevado."), paquete).ok).toBe(true);
  });
});

