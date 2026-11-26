/**
 * `npm run test:candados-ia` corre solo los candados de la IA (el job `ia-candados` que PI pidió nombrar, condición C3): los
 * de `tests/unit/ia/candados/`, los de SIMULACION y los de las listas del validador. Este candado cuida que el script exista
 * y que apunte a esas carpetas y archivos (que existen), para que no se quede mirando un lugar vacío.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../../../..");
const paquete = JSON.parse(readFileSync(path.join(RAIZ, "package.json"), "utf8")) as { scripts: Record<string, string> };
const OBLIGADOS = [
  "tests/unit/ia/candados", "tests/unit/ia/simulacion", "tests/unit/ia/validador/atribucion.test.ts", "tests/unit/ia/validador/huellas.candado.test.ts",
];

describe("script test:candados-ia", () => {
  it("existe y corre vitest sobre los candados de la IA", () => {
    const script = paquete.scripts["test:candados-ia"];
    expect(script, "falta el script test:candados-ia").toBeDefined();
    expect(script).toMatch(/^vitest run /u);
    for (const ruta of OBLIGADOS) expect(script, ruta).toContain(ruta);
  });

  it("cada ruta que corre existe", () => {
    for (const ruta of OBLIGADOS) expect(existsSync(path.join(RAIZ, ruta)), ruta).toBe(true);
  });
});
