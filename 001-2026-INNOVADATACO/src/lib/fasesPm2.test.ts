import { describe, it, expect } from "vitest";
import { FASES_PM2, esFasePm2, nombreDeFase } from "./fasesPm2";

describe("FASES_PM2 (spec 008, FR-005)", () => {
  it("son cuatro, en el orden de la metodología", () => {
    expect(FASES_PM2.map((f) => f.nombre)).toEqual(["Inicio", "Planeación", "Ejecución", "Cierre"]);
  });

  it("incluye la fase de Cierre, que la UI no ofrecía (solo tenía 3)", () => {
    expect(FASES_PM2.some((f) => f.key === "closing")).toBe(true);
  });

  it("conserva las claves que ya usa el dato vivo: ningún proyecto necesita migración", () => {
    expect(FASES_PM2.map((f) => f.key)).toEqual([
      "initiation",
      "planning",
      "execution",
      "closing",
    ]);
  });
});

describe("esFasePm2 (spec 008, §5.2)", () => {
  it("acepta las cuatro fases de la metodología", () => {
    for (const fase of FASES_PM2) expect(esFasePm2(fase.key)).toBe(true);
  });

  it("rechaza una fase inventada: las fases no son un catálogo abierto", () => {
    expect(esFasePm2("fase-inventada")).toBe(false);
    expect(esFasePm2("")).toBe(false);
  });
});

describe("nombreDeFase (spec 008, R-02)", () => {
  it("traduce la clave al nombre visible", () => {
    expect(nombreDeFase("planning")).toBe("Planeación");
  });

  it("ante una clave heredada desconocida devuelve la clave, no vacío", () => {
    expect(nombreDeFase("fase-heredada")).toBe("fase-heredada");
  });
});
