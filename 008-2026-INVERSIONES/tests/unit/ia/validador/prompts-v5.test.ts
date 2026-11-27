/**
 * Prompt DIARIO v5: un molde por dato de especie (arregla «de la especie de la especie» y «la misma especie»).
 * REGLAS y ESCENARIOS siguen en v3, byte a byte: sus hashes no cambian. Sin dígitos fuera del id de ejemplo y sin
 * lenguaje de consejo (detector `prohibidasEn`, con control positivo).
 */
import { describe, expect, it } from "vitest";
import { PROMPTS, VERSIONES_PROMPT } from "@/ia/prompts/prompts";
import { prohibidasEn } from "../../operar/informe/lenguaje";

const HASH_REGLAS_V3 = "276f369f69801eaeecb61bb6d3262802190c56b2f642cfc6746389c2c836faa3";
const HASH_ESCENARIOS_V3 = "f3ea6626c67314fa2c9140f5033814b5dfcc171a83e9347121f8a64cda1cdd97";
const HASH_DIARIO_V4 = "ee6162ea6fbfefc03d026032c991450abb26d18b78d29478fc3d2596348b306c";

describe("prompt DIARIO v5", () => {
  const texto = PROMPTS.DIARIO.texto;

  it("el DIARIO vigente es v6 (con otro hash que la v4; la v5 sigue en el historial), y REGLAS y ESCENARIOS siguen en v3 con el mismo hash", () => {
    expect(VERSIONES_PROMPT.DIARIO).toBe("resumen-diario-v6");
    expect(PROMPTS.DIARIO.version).toBe("resumen-diario-v6");
    expect(PROMPTS.DIARIO.hash).not.toBe(HASH_DIARIO_V4);
    expect(PROMPTS.REGLAS.version).toBe("resumen-reglas-v3");
    expect(PROMPTS.REGLAS.hash).toBe(HASH_REGLAS_V3);
    expect(PROMPTS.ESCENARIOS.version).toBe("resumen-escenarios-v3");
    expect(PROMPTS.ESCENARIOS.hash).toBe(HASH_ESCENARIOS_V3);
  });

  it("no lleva dígitos fuera del id de ejemplo", () => {
    expect(texto.replace(/H01/g, "")).not.toMatch(/\p{N}/u);
  });

  it("no tiene lenguaje de consejo (control positivo: el detector ve una frase plantada)", () => {
    expect(prohibidasEn(`${texto} Le recomendamos comprar ya.`).length).toBeGreaterThan(0);
    expect(prohibidasEn(texto)).toEqual([]);
  });
});
