// Candado de la regla de `precios:exportar` con los símbolos del portafolio (decisión del CEO Inversiones,
// 2026-11-21): la Fábrica solo lo corre con orden del CEO, sacando la lista de producción sin imprimirla, en una
// carpeta 700 y borrándola al terminar. AGENTS.md y el runbook §11 dicen lo mismo; la regla vieja («no lo corra la
// Fábrica» / «la Fábrica nunca la lee») no vuelve.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const AGENTS = readFileSync(ruta008("AGENTS.md"), "utf8");
const RUNBOOK = readFileSync(ruta008("docs/despliegue/produccion.md"), "utf8");

/** La fila de `precios:exportar` en la tabla de comandos de AGENTS.md. */
function filaExportar(): string {
  const fila = AGENTS.split("\n").find((l) => l.startsWith("| `npm run -s precios:exportar"));
  expect(fila, "falta la fila de precios:exportar en AGENTS.md").toBeDefined();
  return fila ?? "";
}

/** El paso 1 de los precios en el §11: desde «En el Mac del dueño» hasta el paso 2. */
function pasoExportar(): string {
  const inicio = RUNBOOK.indexOf("1. **En el Mac del dueño, que sí tiene red,**");
  const fin = RUNBOOK.indexOf("2. **El CSV viaja por stdin", inicio);
  expect(inicio, "falta el paso 1 de los precios en el §11").toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(inicio);
  return RUNBOOK.slice(inicio, fin);
}

describe("regla de precios:exportar con los símbolos del portafolio", () => {
  for (const [donde, texto] of [["AGENTS.md", filaExportar], ["runbook §11", pasoExportar]] as const) {
    it(`${donde}: la Fábrica solo con orden del CEO Inversiones, lista de producción sin imprimir, carpeta 700 y borrado`, () => {
      const t = texto();
      expect(t).toContain("solo con orden del CEO Inversiones");
      expect(t).toMatch(/de producción/);
      expect(t).toMatch(/sin imprimirla/);
      expect(t).toMatch(/carpeta 700/);
      expect(t).toMatch(/la borra al terminar/);
    });

    it(`${donde}: no vuelve la regla vieja`, () => {
      const t = texto();
      expect(t).not.toContain("No lo corra la Fábrica");
      expect(t).not.toContain("la Fábrica nunca la lee");
      expect(t).not.toContain("la Fábrica no la lee");
    });
  }

  it("el §11 sigue diciendo que el CSV no es público (las especies son la composición del portafolio)", () => {
    expect(pasoExportar()).toContain("**El CSV no es público:**");
  });
});
