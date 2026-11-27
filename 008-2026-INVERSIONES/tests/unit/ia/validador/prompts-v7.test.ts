/**
 * Prompt DIARIO v7 (tercera vuelta del defecto de las obligatorias): conserva lo de v6 (sin nombrar lo que prohíbe, etiquetas
 * no obligatorias en los ejemplos) y dice la estructura exacta de la salida ideal: una frase de datos que no son de especie y,
 * si la hay, otra con un solo dato de especie y su molde; cada frase termina en el punto y nunca en coma; la RESPUESTA trae
 * las dos frases. El texto nuevo no siembra ordinales ni números nuevos. REGLAS y ESCENARIOS siguen en v3, byte a byte.
 * Datos y ejemplos inventados.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO, entradaDeCatalogo } from "@/ia/catalogo";
import { OBLIGATORIOS_DIARIO } from "@/ia/hechos/diario";
import { PROMPTS, VERSIONES_PROMPT } from "@/ia/prompts/prompts";
import { prohibidasEn } from "../../operar/informe/lenguaje";

const HASH_REGLAS_V3 = "276f369f69801eaeecb61bb6d3262802190c56b2f642cfc6746389c2c836faa3";
const HASH_ESCENARIOS_V3 = "f3ea6626c67314fa2c9140f5033814b5dfcc171a83e9347121f8a64cda1cdd97";
const HASH_DIARIO_V4 = "ee6162ea6fbfefc03d026032c991450abb26d18b78d29478fc3d2596348b306c";
const HASH_DIARIO_V5 = "a96c22d73eb9035b05b6403a8b8d49b7744a164e6c8f37fd0ed237cebd8389a5";
const HASH_DIARIO_V6 = "4e08692758f40f388cee7afc4a42fd720edbe8a3cc7bbc52368cdc5bb7f8d716";
const LARGO_MINIMO = 5926;
const LARGO_MAXIMO = 6621;
const MARCA_EJEMPLOS = "Ejemplos de frases correctas (solo la forma):";

const PALABRA_MISMA = /\bmism[oa]s?\b/iu;
// `\b` de JS solo conoce letras ASCII: con «subió» o «cerró» (acabadas en tilde) no muerde; por eso los bordes son de Unicode.
const VERBOS_DE_MOVIMIENTO = /(?<![\p{L}\p{N}])(subió|bajó|subieron|bajaron|mantuvo|cerró)(?![\p{L}\p{N}])/iu;
const ORDINALES = /(?<![\p{L}\p{N}])(primer[oa]s?|segund[oa]s?|tercer[oa]s?)(?![\p{L}\p{N}])/iu;
const VALORACION = /\b(baja|alta|bajista|alto|bajo|caída|justo)\b/u;

const FRASES_NUEVAS: readonly string[] = [
  "- Cada dato se escribe con su etiqueta completa, tal cual, y su referencia ocupa el lugar de la cifra; un dato de especie, con su molde. Una etiqueta sin su referencia hace rechazar el resumen, y una referencia sin su etiqueta también.",
  "- No describa movimientos ni valore los datos: después de cada etiqueta van «es» o «son» y la referencia de ese dato, nunca otro verbo ni un adjetivo, también después de la «y».",
  "- Use solo las palabras de las etiquetas de los hechos, palabras de enlace (el, la, los, las, de, en, y, pero, también, además) y los verbos es y son. Una palabra distinta hace rechazar el resumen: no agregue comentarios.",
  "- Un hecho con el campo especie es un dato de una especie: escríbalo en una frase propia, sin otros datos, con el molde de su etiqueta: ",
  " En [nombre], cite el id de su campo especie (no use el campo sujeto); en [dato], el id del propio dato. Las dos referencias son distintas: lo que sigue a «de la especie» es siempre [nombre], nunca el id del dato. La etiqueta ya trae «de la especie»: no la repita. Para otro dato de esa especie, escriba otra frase con su molde. El nombre de una especie nunca va solo en una frase, y nunca cite el nombre de otra especie en ella.",
  "- Escriba una o dos frases. Una frase lleva datos que no son de especie y otra, si la hay, lleva un solo dato de especie y su molde; nunca escriba más de un dato de especie en el resumen. Cada frase termina en el segmento de texto «.» y nunca en una coma, y cada elemento de la lista es una sola oración. Cada frase tiene hasta doscientos ochenta caracteres, cifras incluidas, y las dos juntas, hasta seiscientos.",
  "Cada dato que mencione lleva su referencia.",
];

const REF = '{"ref":"H01"}';
const txt = (t: string): string => `{"texto":"${t}"}`;
const EJEMPLOS_V7: readonly string[] = [
  `{"segmentos":[${txt("La ganancia sin vender es")},${REF},${txt(", y la ganancia por ventas es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("Los dividendos recibidos son")},${REF},${txt(", y las comisiones pagadas son")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("Las especies sin precio son")},${REF},${txt(", y las especies con cierre atrasado son")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("El valor de la unidad del fondo es")},${REF},${txt(", y el valor del fondo es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("El precio de cierre de la especie")},${REF},${txt("es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("La variación del día de la especie")},${REF},${txt("es")},${REF},${txt(".")}]}`,
];
const RESPUESTA_V7 = `Responda solo con un JSON de esta forma: {"frases":[{"segmentos":[${txt("La ganancia sin vender es")},${REF},${txt(", y la ganancia por ventas es")},${REF},${txt(".")}]},{"segmentos":[${txt("El precio de cierre de la especie")},${REF},${txt("es")},${REF},${txt(".")}]}]}`;
const ETIQUETAS_DE_EJEMPLO = ["ganancia sin vender", "ganancia por ventas", "dividendos recibidos", "comisiones pagadas", "especies sin precio", "especies con cierre atrasado", "valor de la unidad del fondo", "valor del fondo", "precio de cierre de la especie", "variación del día de la especie"];

/** Desde los ejemplos hasta el final del prompt (incluye la forma de RESPUESTA). */
const desdeLosEjemplos = (texto: string): string => texto.slice(texto.indexOf(MARCA_EJEMPLOS));
const etiquetasObligatorias = (): readonly string[] =>
  OBLIGATORIOS_DIARIO.map((clave) => entradaDeCatalogo("DIARIO", clave)?.etiqueta ?? "").filter((e) => e !== "");

describe("prompt DIARIO v7", () => {
  const texto = PROMPTS.DIARIO.texto;

  it("es la versión v7, con un hash distinto del de v6, v5 y v4; REGLAS y ESCENARIOS siguen en v3 con el mismo hash", () => {
    expect(VERSIONES_PROMPT.DIARIO).toBe("resumen-diario-v7");
    expect(PROMPTS.DIARIO.version).toBe("resumen-diario-v7");
    expect(PROMPTS.DIARIO.hash).not.toBe(HASH_DIARIO_V6);
    expect(PROMPTS.DIARIO.hash).not.toBe(HASH_DIARIO_V5);
    expect(PROMPTS.DIARIO.hash).not.toBe(HASH_DIARIO_V4);
    expect(PROMPTS.REGLAS.version).toBe("resumen-reglas-v3");
    expect(PROMPTS.REGLAS.hash).toBe(HASH_REGLAS_V3);
    expect(PROMPTS.ESCENARIOS.version).toBe("resumen-escenarios-v3");
    expect(PROMPTS.ESCENARIOS.hash).toBe(HASH_ESCENARIOS_V3);
  });

  it("no nombra «misma» ni «mismo» (control positivo: REGLAS, que no cambia, sí los dice)", () => {
    expect(texto).not.toMatch(PALABRA_MISMA);
    expect(PROMPTS.REGLAS.texto).toMatch(PALABRA_MISMA);
  });

  it("el largo del prompt está en la ventana frente a v5", () => {
    expect(texto.length).toBeGreaterThanOrEqual(LARGO_MINIMO);
    expect(texto.length).toBeLessThanOrEqual(LARGO_MAXIMO);
  });

  it("el texto nuevo (movimiento, estructura y RESPUESTA) no siembra ordinales (control positivo: REGLAS dice «primera»)", () => {
    expect([FRASES_NUEVAS[1], FRASES_NUEVAS[5], RESPUESTA_V7].join(" ")).not.toMatch(ORDINALES);
    expect(PROMPTS.REGLAS.texto).toMatch(ORDINALES);
  });

  it("el detector de verbos muerde con tilde final (texto plantado)", () => {
    expect("el valor subió hoy").toMatch(VERBOS_DE_MOVIMIENTO);
    expect("Cerró.").toMatch(VERBOS_DE_MOVIMIENTO);
    expect("subiósolo").not.toMatch(VERBOS_DE_MOVIMIENTO);
  });

  it("el texto nuevo no usa por, desde, con, según, ante, tras, frente ni como fuera de una etiqueta", () => {
    const nuevas = [FRASES_NUEVAS[1], FRASES_NUEVAS[5]].join(" ");
    expect(nuevas).not.toMatch(/(?<![\p{L}\p{N}])(por|desde|con|según|ante|tras|frente|como)(?![\p{L}\p{N}])/iu);
  });

  it("no nombra verbos de movimiento (control positivo: REGLAS los dice)", () => {
    expect(texto).not.toMatch(VERBOS_DE_MOVIMIENTO);
    expect(PROMPTS.REGLAS.texto).toMatch(VERBOS_DE_MOVIMIENTO);
  });

  it("no nombra adjetivos de valoración ni «justo», en minúsculas (control positivo: REGLAS los dice)", () => {
    expect(texto).not.toMatch(VALORACION);
    expect(PROMPTS.REGLAS.texto).toMatch(VALORACION);
  });

  it.each(FRASES_NUEVAS)("contiene la frase nueva exacta: %s", (frase) => {
    expect(texto).toContain(frase);
  });

  it("la RESPUESTA empieza con una etiqueta no obligatoria, no con «El valor de las acciones es»", () => {
    expect(texto).toContain(RESPUESTA_V7);
    expect(texto).not.toContain(txt("El valor de las acciones es"));
  });

  it.each(EJEMPLOS_V7)("los ejemplos traen la frase de v7: %s", (ejemplo) => {
    expect(desdeLosEjemplos(texto)).toContain(ejemplo);
  });

  it("cada etiqueta de ejemplo existe tal cual en el catálogo del DIARIO", () => {
    const etiquetas = Object.values(CATALOGO.DIARIO).map((e) => e.etiqueta);
    for (const etiqueta of ETIQUETAS_DE_EJEMPLO) expect(etiquetas, etiqueta).toContain(etiqueta);
  });

  it("desde los ejemplos hasta el final no hay etiquetas de los obligatorios (control positivo: el detector las ve en un texto plantado)", () => {
    const etiquetas = etiquetasObligatorias();
    expect(etiquetas.length).toBe(OBLIGATORIOS_DIARIO.length);
    const cola = desdeLosEjemplos(texto).toLowerCase();
    expect(cola.length).toBeGreaterThan(300);
    for (const etiqueta of etiquetas) expect(cola, etiqueta).not.toContain(etiqueta.toLowerCase());
    expect(etiquetas.some((e) => `${cola} la ganancia total es`.includes(e.toLowerCase()))).toBe(true);
  });

  it("no lleva dígitos fuera del id de ejemplo y no tiene lenguaje de consejo (control positivo)", () => {
    expect(texto.replace(/H01/g, "")).not.toMatch(/\p{N}/u);
    expect(prohibidasEn(texto)).toEqual([]);
    expect(prohibidasEn(`${texto} Le recomendamos comprar ya.`).length).toBeGreaterThan(0);
  });
});
