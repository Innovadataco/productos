// El «hoy» del E2E del plan es UNO por corrida (e2e-runner MEDIO): la siembra y las pruebas corren en procesos
// distintos; si cada uno mirara el reloj, una corrida que cruza la medianoche de Bogotá esperaría otras fechas.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { hoyDelE2E } from "../../e2e/base";

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), "utf8");
const anterior = process.env.E2E_HOY;

afterEach(() => {
  if (anterior === undefined) delete process.env.E2E_HOY;
  else process.env.E2E_HOY = anterior;
});

describe("el hoy del E2E", () => {
  it("es el que fija la corrida en E2E_HOY (AAAA-MM-DD), a medianoche UTC como las columnas DATE", () => {
    process.env.E2E_HOY = "2026-11-21";
    expect(hoyDelE2E()).toEqual(new Date("2026-11-21T00:00:00.000Z"));
  });

  it("sin E2E_HOY (o mal escrito) es el día de hoy en Colombia", () => {
    delete process.env.E2E_HOY;
    const sinVariable = hoyDelE2E();
    process.env.E2E_HOY = "21/11/2026";
    expect(hoyDelE2E()).toEqual(sinVariable);
    expect(sinVariable.getTime() % 86_400_000).toBe(0);
  });

  it("la configuración lo fija una vez y se lo pasa a la app; la siembra y las pruebas del plan lo usan", () => {
    expect(leer("playwright.config.ts")).toMatch(/process\.env\.E2E_HOY \?\?=/);
    expect(leer("playwright.config.ts")).toMatch(/E2E_HOY: HOY_E2E/);
    expect(leer("tests/e2e/sembrar-plan.ts")).toMatch(/hoyDelE2E\(\)/);
    expect(leer("tests/e2e/plan.spec.ts")).toMatch(/hoyDelE2E\(\)/);
    expect(leer("tests/e2e/plan.spec.ts")).not.toMatch(/fechaEnBogota\(new Date\(\)\)/);
  });
});
