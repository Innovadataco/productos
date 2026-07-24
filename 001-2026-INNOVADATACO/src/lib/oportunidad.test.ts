import { describe, it, expect } from "vitest";
import { validarPartidas, construirDatosPartidas } from "./oportunidad";

describe("validarPartidas (spec 006, FR-008)", () => {
  it("acepta la ausencia de partidas (son opcionales)", () => {
    expect(validarPartidas(undefined)).toBeNull();
    expect(validarPartidas(null)).toBeNull();
    expect(validarPartidas([])).toBeNull();
  });

  it("acepta partidas válidas", () => {
    expect(
      validarPartidas([
        { concepto: "Obra civil", monto: 1000000, moneda: "COP" },
        { concepto: "Interventoría", monto: "250000.50" },
      ]),
    ).toBeNull();
  });

  it("rechaza si no es una lista", () => {
    expect(validarPartidas({ concepto: "x" })).toMatch(/lista/);
  });

  it("rechaza una partida sin concepto", () => {
    expect(validarPartidas([{ monto: 100 }])).toMatch(/concepto/);
    expect(validarPartidas([{ concepto: "   ", monto: 100 }])).toMatch(/concepto/);
  });

  it("rechaza un monto no numérico", () => {
    expect(validarPartidas([{ concepto: "x", monto: "abc" }])).toMatch(/número/);
  });

  it("rechaza un monto negativo", () => {
    expect(validarPartidas([{ concepto: "x", monto: -5 }])).toMatch(/negativo/);
  });
});

describe("construirDatosPartidas", () => {
  it("devuelve undefined sin partidas (no crea nada)", () => {
    expect(construirDatosPartidas(undefined)).toBeUndefined();
    expect(construirDatosPartidas([])).toBeUndefined();
  });

  it("arma el create anidado con moneda por defecto COP", () => {
    const r = construirDatosPartidas([{ concepto: " Obra ", monto: "1000" }]);
    expect(r?.create).toHaveLength(1);
    const partida = (r?.create as Array<{ concepto: string; moneda: string; monto: unknown }>)[0];
    expect(partida.concepto).toBe("Obra");
    expect(partida.moneda).toBe("COP");
    expect(Number(partida.monto)).toBe(1000);
  });

  it("respeta la moneda indicada", () => {
    const r = construirDatosPartidas([{ concepto: "x", monto: 5, moneda: "USD" }]);
    const partida = (r?.create as Array<{ moneda: string }>)[0];
    expect(partida.moneda).toBe("USD");
  });
});
