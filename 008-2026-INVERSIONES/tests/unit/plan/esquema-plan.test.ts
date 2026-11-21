// Candado del esquema del plan (fase B, corte 1): tipos de dinero y cantidades, y la cadena
// plan → regla → decisión → orden expresada con claves foráneas, no solo en el código.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const esquema = readFileSync(fileURLToPath(new URL("../../../prisma/schema.prisma", import.meta.url)), "utf8");
const codigo = esquema.replace(/\/\/.*$/gm, "");

function campos(modelo: string): Map<string, string> {
  const bloque = new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`).exec(codigo);
  if (!bloque?.[1]) throw new Error(`No existe el modelo ${modelo}`);
  const mapa = new Map<string, string>();
  for (const linea of bloque[1].split("\n")) {
    const m = /^\s+(\w+)\s+(\S+)(.*)$/.exec(linea);
    if (m?.[1] && m[2]) mapa.set(m[1], `${m[2]}${m[3] ?? ""}`);
  }
  return mapa;
}

const bloque = (modelo: string) => new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`).exec(codigo)?.[1] ?? "";

describe("candado del esquema del plan", () => {
  it("el nivel de una regla es Decimal con precisión explícita", () => {
    expect(campos("ReglaPlan").get("nivel")).toMatch(/^Decimal\?\s+@db\.Decimal\(20, 6\)/);
  });

  it.each([
    ["ReglaPlan", "cantidad"],
    ["Decision", "cantidad"],
  ])("%s.%s (acciones) es BigInt", (modelo, campo) => {
    expect(campos(modelo).get(campo)).toMatch(/^BigInt\b/);
  });

  it("la versión del plan es un número único y las fechas de negocio son @db.Date", () => {
    expect(campos("PlanVersion").get("version")).toMatch(/^Int\s+@unique/);
    expect(campos("PlanVersion").get("vigenteDesde")).toMatch(/@db\.Date/);
    expect(campos("Decision").get("fechaDecision")).toMatch(/@db\.Date/);
  });

  it("la regla citada por una decisión es de la misma versión (FK compuesta)", () => {
    expect(campos("Decision").get("regla")).toMatch(/fields: \[reglaId, planVersionId\], references: \[id, planVersionId\]/);
  });

  it("una corrección de enlace es de la misma orden (FK compuesta) y una decisión se corrige una sola vez", () => {
    expect(campos("EnlaceDecisionOrden").get("reemplaza")).toMatch(/fields: \[reemplazaId, ordenId\], references: \[id, ordenId\]/);
    expect(campos("Decision").get("reemplazaId")).toMatch(/^String\?\s+@unique/);
  });

  it("ninguna tabla del plan tiene campos de edición (nada se sobrescribe)", () => {
    for (const modelo of ["PlanVersion", "ReglaPlan", "Decision", "EnlaceDecisionOrden"]) {
      expect(bloque(modelo), modelo).not.toBe("");
      expect(bloque(modelo), modelo).not.toMatch(/@updatedAt|actualizad|editad/i);
    }
  });
});
