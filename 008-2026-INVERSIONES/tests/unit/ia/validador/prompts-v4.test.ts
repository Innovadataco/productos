/**
 * Prompt DIARIO v4 (T5): el código escribe los obligatorios, así que el prompt ya no manda citarlos; el modelo escribe de
 * una a cuatro frases con los demás hechos, los límites van en palabras y los ejemplos usan etiquetas de hechos NO
 * obligatorios (con las de los obligatorios, el modelo las repetía). REGLAS y ESCENARIOS siguen en v3, byte a byte: sus
 * hashes no cambian. Sin lenguaje de consejo (detector `prohibidasEn`, con control positivo).
 */
import { describe, expect, it } from "vitest";
import { entradaDeCatalogo } from "@/ia/catalogo";
import { OBLIGATORIOS_DIARIO } from "@/ia/hechos/diario";
import { PROMPTS, VERSIONES_PROMPT } from "@/ia/prompts/prompts";
import { prohibidasEn } from "../../operar/informe/lenguaje";

const HASH_REGLAS_V3 = "276f369f69801eaeecb61bb6d3262802190c56b2f642cfc6746389c2c836faa3";
const HASH_ESCENARIOS_V3 = "f3ea6626c67314fa2c9140f5033814b5dfcc171a83e9347121f8a64cda1cdd97";
const MARCA_EJEMPLOS = "Ejemplos de frases correctas (solo la forma):";
const MARCA_RESPUESTA = "Responda solo con un JSON";

const ejemplosDe = (texto: string): string => texto.slice(texto.indexOf(MARCA_EJEMPLOS), texto.indexOf(MARCA_RESPUESTA));
const etiquetasObligatorias = (): readonly string[] =>
  OBLIGATORIOS_DIARIO.map((clave) => entradaDeCatalogo("DIARIO", clave)?.etiqueta ?? "").filter((e) => e !== "");

describe("prompt DIARIO v4", () => {
  const texto = PROMPTS.DIARIO.texto;

  it("el DIARIO vigente (v7) conserva lo de v4, y REGLAS y ESCENARIOS siguen en v3 con el mismo hash", () => {
    expect(VERSIONES_PROMPT.DIARIO).toBe("resumen-diario-v7");
    expect(PROMPTS.REGLAS.version).toBe("resumen-reglas-v3");
    expect(PROMPTS.REGLAS.hash).toBe(HASH_REGLAS_V3);
    expect(PROMPTS.ESCENARIOS.version).toBe("resumen-escenarios-v3");
    expect(PROMPTS.ESCENARIOS.hash).toBe(HASH_ESCENARIOS_V3);
  });

  it("ya no manda citar los obligatorios y dice que los escribe el sistema", () => {
    const minusculas = texto.toLowerCase();
    expect(minusculas).not.toContain("cite todos los hechos obligatorios");
    expect(minusculas).not.toContain("son obligatorios el valor de las acciones");
    expect(minusculas).toContain("el sistema ya escribe");
    expect(minusculas).toContain("obligatorio falso");
  });

  it("pide una o dos frases, y no seis", () => {
    expect(texto).toContain("Escriba una o dos frases");
    expect(texto).not.toContain("entre una y cuatro frases");
    expect(texto).not.toContain("entre una y seis frases");
  });

  it("los ejemplos no usan las etiquetas de los hechos obligatorios (control positivo: el detector las ve en una frase plantada)", () => {
    const etiquetas = etiquetasObligatorias();
    expect(etiquetas.length).toBe(OBLIGATORIOS_DIARIO.length);
    const ejemplos = ejemplosDe(texto).toLowerCase();
    expect(ejemplos.length).toBeGreaterThan(100);
    for (const etiqueta of etiquetas) expect(ejemplos, etiqueta).not.toContain(etiqueta.toLowerCase());
    const plantado = `${ejemplos} la ganancia total es`;
    expect(etiquetas.some((e) => plantado.includes(e.toLowerCase()))).toBe(true);
  });

  it("no lleva dígitos fuera del id de ejemplo y no tiene lenguaje de consejo", () => {
    expect(texto.replace(/H01/g, "")).not.toMatch(/\p{N}/u);
    expect(prohibidasEn(texto)).toEqual([]);
  });
});
