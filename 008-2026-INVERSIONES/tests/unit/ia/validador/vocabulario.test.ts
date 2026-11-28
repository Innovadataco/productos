/**
 * El vocabulario cerrado del validador (IDIOMA.VOCABULARIO): las palabras de las etiquetas del catálogo (y sus plurales
 * y singulares), las de las marcas que se cotejan contra el paquete y una lista corta de palabras funcionales y verbos
 * neutros. Candados: las etiquetas y las frases válidas caben en él; ninguna palabra suya dispara un patrón de
 * recomendación, predicción, trato, cifra en palabras, idioma o afirmación sin dato; y una palabra de fuera se rechaza.
 */
import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/ia/catalogo";
import { TIPOS_RESUMEN } from "@/ia/contrato";
import { coincidencias } from "@/ia/validador/patron";
import { PATRONES_CAUSA } from "@/ia/validador/patrones-causa";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_SIN_DATO } from "@/ia/validador/patrones-lengua";
import { PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "@/ia/validador/patrones-redaccion";
import { CONDICIONALES, PALABRAS_BASE, palabrasFueraDelVocabulario } from "@/ia/validador/vocabulario";
import { FRASES_VALIDAS, frase, paqueteFicticio } from "./apoyo/salidas.ficticio";

/** Los patrones que valen en cualquier lugar de la frase (los anclados al inicio, como el imperativo inicial, dependen del lugar). */
const PROHIBIDOS = [...PATRONES_RECOMENDACION, ...PATRONES_PREDICCION, ...PATRONES_TRATO, ...PATRONES_CIFRA_EN_PALABRAS, ...PATRONES_IDIOMA, ...PATRONES_SIN_DATO, ...PATRONES_CAUSA]
  .filter((p) => p.antes !== "^");

describe("vocabulario cerrado", () => {
  it.each(TIPOS_RESUMEN)("%s: cada etiqueta del catálogo cabe en el vocabulario", (tipo) => {
    for (const entrada of Object.values(CATALOGO[tipo])) expect([entrada.etiqueta, palabrasFueraDelVocabulario(entrada.etiqueta, tipo)]).toEqual([entrada.etiqueta, []]);
  });

  it.each(TIPOS_RESUMEN)("%s: las frases válidas de las pruebas caben en el vocabulario de su tipo", (tipo) => {
    const paquete = paqueteFicticio(tipo);
    for (const plantilla of FRASES_VALIDAS[tipo]) {
      const { texto } = frase(paquete, plantilla);
      expect([texto, palabrasFueraDelVocabulario(texto, tipo)]).toEqual([texto, []]);
    }
  });

  it("ninguna palabra de la lista base ni del condicional dispara un patrón prohibido", () => {
    expect(PALABRAS_BASE.length).toBeGreaterThan(41);
    for (const palabra of [...PALABRAS_BASE, ...CONDICIONALES]) expect([palabra, coincidencias(palabra, PROHIBIDOS)]).toEqual([palabra, []]);
  });

  it("la lista base está congelada, en minúsculas, sin tildes y sin repetir", () => {
    expect(Object.isFrozen(PALABRAS_BASE)).toBe(true);
    expect(new Set(PALABRAS_BASE).size).toBe(PALABRAS_BASE.length);
    for (const palabra of PALABRAS_BASE) expect(palabra).toMatch(/^[a-zñ]+$/u);
  });

  it("control positivo: una palabra de fuera se nombra (una vez), las de dentro no; plurales, singulares, tildes y mayúsculas cuentan", () => {
    expect(palabrasFueraDelVocabulario("El valor de las acciones es favorable y favorable.", "DIARIO")).toEqual(["favorable"]);
    expect(palabrasFueraDelVocabulario("La acción y las especies; la Especie y las ACCIONES; las especies atrasadas.", "DIARIO")).toEqual([]);
    expect(palabrasFueraDelVocabulario("Subió, bajó y se mantuvo {H03}, a la baja.", "DIARIO")).toEqual([]);
  });

  it("el vocabulario es el del tipo: una palabra de otro tipo no vale; las de una marca solo dentro de la marca", () => {
    expect(palabrasFueraDelVocabulario("El escenario alto.", "DIARIO")).toEqual(["escenario", "alto"]);
    expect(palabrasFueraDelVocabulario("El escenario alto.", "ESCENARIOS")).toEqual([]);
    expect(palabrasFueraDelVocabulario("Con baja y el mismo dato.", "DIARIO")).toEqual(["baja", "mismo"]);
  });

  it("el condicional solo vale en ESCENARIOS", () => {
    expect(palabrasFueraDelVocabulario("La especie quedaría.", "DIARIO")).toEqual(["quedaria"]);
    expect(palabrasFueraDelVocabulario("La especie quedaría.", "REGLAS")).toEqual(["quedaria"]);
    expect(palabrasFueraDelVocabulario("La especie quedaría.", "ESCENARIOS")).toEqual([]);
  });

  it("la lista base no trae preposiciones ni conectores de causa", () => {
    for (const palabra of ["ante", "segun", "tras", "frente", "como", "desde", "con", "por"]) expect(PALABRAS_BASE).not.toContain(palabra);
  });

  it("«por», «con» y «desde» valen solo donde salen de las etiquetas del tipo", () => {
    const fuera = (palabra: string, tipo: (typeof TIPOS_RESUMEN)[number]): readonly string[] => palabrasFueraDelVocabulario(palabra, tipo);
    for (const tipo of TIPOS_RESUMEN) expect(fuera("por", tipo)).toEqual([]);
    expect(fuera("con", "DIARIO")).toEqual([]);
    expect(fuera("con", "ESCENARIOS")).toEqual([]);
    expect(fuera("con", "REGLAS")).toEqual(["con"]);
    expect(fuera("desde", "REGLAS")).toEqual([]);
    expect(fuera("desde", "DIARIO")).toEqual(["desde"]);
    expect(fuera("desde", "ESCENARIOS")).toEqual(["desde"]);
    for (const tipo of TIPOS_RESUMEN) for (const palabra of ["ante", "segun", "tras", "frente", "como"]) expect(fuera(palabra, tipo)).toEqual([palabra]);
  });

  it("la lista base no trae «cuando», los verbos de atribución ni las preposiciones sin uso medido", () => {
    const sacadas = ["cuando", "corresponde", "corresponden", "equivale", "equivalen", "representa", "representan", "indica", "indican", "muestra", "muestran",
      "mientras", "aunque", "contra", "sobre", "hasta", "hacia", "entre", "donde", "sino", "sin"];
    for (const palabra of sacadas) expect([palabra, PALABRAS_BASE.includes(palabra)]).toEqual([palabra, false]);
  });

  it("las palabras de atribución y de contexto sacadas se rechazan en los tres tipos", () => {
    for (const tipo of TIPOS_RESUMEN) for (const palabra of ["cuando", "corresponde", "equivale", "representa", "indica", "muestra", "mientras", "aunque", "donde", "sino"]) {
      expect([tipo, palabra, palabrasFueraDelVocabulario(palabra, tipo)]).toEqual([tipo, palabra, [palabra]]);
    }
  });

  it("«pero» sigue en la lista base; «sin» sale: solo vale donde sale de las etiquetas (CAUSA.SIN)", () => {
    expect(PALABRAS_BASE).toContain("pero");
    expect(PALABRAS_BASE).not.toContain("sin");
    expect(palabrasFueraDelVocabulario("sin", "ESCENARIOS")).toEqual(["sin"]);
  });
});
