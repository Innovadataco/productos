/**
 * Prompt DIARIO v6 (segunda vuelta del defecto de las obligatorias): el molde ya no termina en «es [dato]» contra la regla
 * del verbo; se prohíbe la etiqueta sin su referencia (y no solo la referencia sin su etiqueta); el texto no nombra las
 * palabras que prohíbe («misma», verbos de movimiento, adjetivos de valoración); el ejemplo de RESPUESTA y los de frases
 * usan etiquetas NO obligatorias. REGLAS y ESCENARIOS siguen en v3, byte a byte. Datos y ejemplos inventados.
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
const MARCA_EJEMPLOS = "Ejemplos de frases correctas (solo la forma):";

const PALABRA_MISMA = /\bmism[oa]s?\b/iu;
const VERBOS_DE_MOVIMIENTO = /\b(subió|bajó|subieron|bajaron|mantuvo|cerró)\b/iu;
const VALORACION = /\b(baja|alta|bajista|alto|bajo|caída|justo)\b/u;

const FRASES_NUEVAS: readonly string[] = [
  "- Cada dato se escribe con su etiqueta completa, tal cual, y su referencia ocupa el lugar de la cifra; un dato de especie, con su molde. Una etiqueta sin su referencia hace rechazar el resumen, y una referencia sin su etiqueta también.",
  "- No describa movimientos ni valore los datos: después de cada etiqueta van «es» o «son» y la referencia de ese dato, nunca otro verbo ni un adjetivo, también en la segunda parte de la frase.",
  "- Use solo las palabras de las etiquetas de los hechos, palabras de enlace (el, la, los, las, de, en, y, pero, también, además) y los verbos es y son. Una palabra distinta hace rechazar el resumen: no agregue comentarios.",
  "- Un hecho con el campo especie es un dato de una especie: escríbalo en una frase propia, sin otros datos, con el molde de su etiqueta: ",
  " En [nombre], cite el id de su campo especie (no use el campo sujeto); en [dato], el id del propio dato. Las dos referencias son distintas: lo que sigue a «de la especie» es siempre [nombre], nunca el id del dato. La etiqueta ya trae «de la especie»: no la repita. Para otro dato de esa especie, escriba otra frase con su molde. El nombre de una especie nunca va solo en una frase, y nunca cite el nombre de otra especie en ella.",
  "- Escriba una o dos frases. Con las cifras ya puestas, cada frase tiene hasta doscientos ochenta caracteres y las dos juntas, hasta seiscientos.",
  "Cada dato que mencione lleva su referencia.",
];

const REF = '{"ref":"H01"}';
const txt = (t: string): string => `{"texto":"${t}"}`;
const EJEMPLOS_V6: readonly string[] = [
  `{"segmentos":[${txt("La ganancia sin vender es")},${REF},${txt(", y la ganancia por ventas es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("Los dividendos recibidos son")},${REF},${txt(", y las comisiones pagadas son")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("Las especies sin precio son")},${REF},${txt(", y las especies con cierre atrasado son")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("El valor de la unidad del fondo es")},${REF},${txt(", y el valor del fondo es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("El precio de cierre de la especie")},${REF},${txt("es")},${REF},${txt(".")}]}`,
  `{"segmentos":[${txt("La variación del día de la especie")},${REF},${txt("es")},${REF},${txt(".")}]}`,
];
const RESPUESTA_V6 = `Responda solo con un JSON de esta forma: {"frases":[{"segmentos":[${txt("La ganancia sin vender es")},${REF},${txt(".")}]}]}`;
const ETIQUETAS_DE_EJEMPLO = ["ganancia sin vender", "ganancia por ventas", "dividendos recibidos", "comisiones pagadas", "especies sin precio", "especies con cierre atrasado", "valor de la unidad del fondo", "valor del fondo", "precio de cierre de la especie", "variación del día de la especie"];

/** Desde los ejemplos hasta el final del prompt (incluye la forma de RESPUESTA). */
const desdeLosEjemplos = (texto: string): string => texto.slice(texto.indexOf(MARCA_EJEMPLOS));
const etiquetasObligatorias = (): readonly string[] =>
  OBLIGATORIOS_DIARIO.map((clave) => entradaDeCatalogo("DIARIO", clave)?.etiqueta ?? "").filter((e) => e !== "");

describe("prompt DIARIO v6", () => {
  const texto = PROMPTS.DIARIO.texto;

  it("es la versión v6, con un hash distinto del de v5 y del de v4; REGLAS y ESCENARIOS siguen en v3 con el mismo hash", () => {
    expect(VERSIONES_PROMPT.DIARIO).toBe("resumen-diario-v6");
    expect(PROMPTS.DIARIO.version).toBe("resumen-diario-v6");
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
    expect(texto).toContain(RESPUESTA_V6);
    expect(texto).not.toContain(txt("El valor de las acciones es"));
  });

  it.each(EJEMPLOS_V6)("los ejemplos traen la frase de v6: %s", (ejemplo) => {
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
