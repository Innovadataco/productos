/**
 * Las fuentes que muestra «fuente · fecha» se leen como español, no como un identificador interno: sin el número del
 * producto, sin dígitos ni «:» (el identificador de un conjunto de datos) y nombrando a Inversiones. Control positivo
 * incluido: el detector muerde con las fuentes viejas.
 */
import { describe, expect, it } from "vitest";
import { FUENTES } from "@/ia/hechos/constantes";

const COMO_IDENTIFICADOR = /[0-9:]/u;
const VIEJAS = ["cálculo de 008 sobre los cierres", "plan vigente de 008", "sfc:qhpu-8ixx"];

describe("FUENTES de los armadores", () => {
  it.each(Object.entries(FUENTES))("%s no lleva dígitos ni «:»", (_clave, texto) => {
    expect(texto).not.toMatch(COMO_IDENTIFICADOR);
  });

  it("control positivo: el detector rechaza las fuentes viejas", () => {
    for (const vieja of VIEJAS) expect(vieja).toMatch(COMO_IDENTIFICADOR);
  });

  it("las propias de la aplicación dicen «Inversiones»", () => {
    for (const clave of ["TABLERO", "REGISTRO", "CONCILIACION", "PLAN", "NIVELES", "DECRETOS", "PROYECCION"] as const) {
      expect(FUENTES[clave], clave).toContain("Inversiones");
    }
  });

  it("el fondo dice la Superintendencia Financiera", () => {
    expect(FUENTES.FONDO).toBe("valor de unidad de la Superintendencia Financiera (SFC)");
  });
});
