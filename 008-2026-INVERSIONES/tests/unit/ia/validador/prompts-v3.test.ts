/**
 * Prompts v3 (frente ia-diario-especie): el modelo toma el nombre de la especie del campo `especie` de la vista (ya
 * resuelto), sin recorrer la cadena de `sujeto`. Y la línea que no se cruza: ningún prompt lleva lenguaje de consejo o
 * de juicio (detector `prohibidasEn` de /operar), con control positivo.
 */
import { describe, expect, it } from "vitest";
import { TIPOS_DIARIOS } from "@/ia/contrato";
import { PROMPTS, VERSIONES_PROMPT } from "@/ia/prompts/prompts";
import { prohibidasEn } from "../../operar/informe/lenguaje";

describe("prompts v3 · especie resuelta", () => {
  it.each(["REGLAS", "ESCENARIOS"] as const)("%s: versión v3 (el DIARIO pasó a v4: prompts-v4.test.ts)", (tipo) => {
    expect(VERSIONES_PROMPT[tipo]).toMatch(/-v3$/);
  });

  it.each(TIPOS_DIARIOS)("%s: describe el campo especie y manda citar ese id para el nombre", (tipo) => {
    const texto = PROMPTS[tipo].texto;
    expect(texto).toContain("(especie, si aplica)");
    expect(texto).toContain("cite el id de su campo especie");
    expect(texto).not.toContain("siga el campo sujeto");
    expect(texto).toContain("Las dos referencias son distintas");
  });

});

describe("prompts · sin lenguaje de consejo ni de juicio", () => {
  it.each(TIPOS_DIARIOS)("%s: el detector no encuentra nada", (tipo) => {
    expect(prohibidasEn(PROMPTS[tipo].texto)).toEqual([]);
  });

  it("control positivo: el detector muerde una frase plantada en el prompt", () => {
    const plantado = `${PROMPTS.DIARIO.texto} ${["Con", "viene"].join("")} revisar.`;
    expect(prohibidasEn(plantado)).toEqual(["conviene"]);
    expect(prohibidasEn(`${PROMPTS.REGLAS.texto} ${["Es", "buen", "momento"].join(" ")}.`)).toEqual(["buen momento"]);
  });
});
