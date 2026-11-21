// Valores en formato es-CO de la ficha (fase B, corte 2). Números inventados.
import { describe, expect, it } from "vitest";
import { leerCantidadInicial, leerDiaMes, leerEnteroEs, leerMontoEs, leerPie } from "@/plan/importar/valores-es";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("leerEnteroEs", () => {
  it.each([
    ["641", 641n],
    ["3.172", 3172n],
    ["1.234.567", 1234567n],
  ])("«%s» → %s", (texto, esperado) => {
    expect(leerEnteroEs(texto)).toBe(esperado);
  });

  it.each(["1.5", "1,5", "", "12a", "1.23.456", "-3"])("rechaza «%s» (nunca adivina)", (texto) => {
    expect(leerEnteroEs(texto)).toBeNull();
  });
});

describe("leerMontoEs", () => {
  it.each([
    ["$1.111", "1111"],
    ["$1.234,5", "1234.5"],
    ["$7,3 M", "7300000"],
    ["$2,71828 M", "2718280"],
    ["$0,123456 M", "123456"],
    ["12,34", "12.34"],
  ])("«%s» → «%s» (texto decimal, sin punto flotante)", (texto, esperado) => {
    expect(leerMontoEs(texto)).toBe(esperado);
  });

  it.each(["$1.5", "abc", "$", "$1,1234567", "US$0,45"])("rechaza «%s»", (texto) => {
    expect(leerMontoEs(texto)).toBeNull();
  });
});

describe("leerDiaMes (fechas pasadas: decisiones y vigencias)", () => {
  it("toma el año del pie de la ficha", () => {
    expect(leerDiaMes("15-mar", dia("2025-03-23"))).toEqual(dia("2025-03-15"));
  });

  it("el mismo día del pie vale", () => {
    expect(leerDiaMes("23-mar", dia("2025-03-23"))).toEqual(dia("2025-03-23"));
  });

  it("si queda después del pie, es del año anterior", () => {
    expect(leerDiaMes("28-dic", dia("2025-01-05"))).toEqual(dia("2024-12-28"));
  });

  it("un 29-feb que no existe en el año del pie se busca en el año anterior", () => {
    expect(leerDiaMes("29-feb", dia("2025-03-23"))).toEqual(dia("2024-02-29"));
    expect(leerDiaMes("29-feb", dia("2027-03-01"))).toBeNull();
  });

  it("un año explícito manda", () => {
    expect(leerDiaMes("7-ago-2031", dia("2025-01-01"))).toEqual(dia("2031-08-07"));
  });

  it.each(["31-feb", "5-xyz", "mar-15", "", "0-mar"])("rechaza «%s»", (texto) => {
    expect(leerDiaMes(texto, dia("2025-03-23"))).toBeNull();
  });
});

describe("leerCantidadInicial (lo que sigue al verbo: «Vender las N…»)", () => {
  it.each([
    [" 120", 120n],
    [" las 3.172", 3172n],
    [" los 641 y el resto", 641n],
    [" 30, quedan", 30n],
    [" 120.", 120n],
  ])("«%s» → %s", (texto, cantidad) => {
    expect(leerCantidadInicial(texto)).toEqual({ tipo: "CANTIDAD", cantidad });
  });

  it.each([" una parte", "", " las de siempre"])("«%s» no trae número", (texto) => {
    expect(leerCantidadInicial(texto)).toEqual({ tipo: "SIN_NUMERO" });
  });

  it.each([" 1.5", " 1,5", " las 2.34", " 12,7 y más"])("«%s» no se trunca: no se reconoce", (texto) => {
    expect(leerCantidadInicial(texto)).toEqual({ tipo: "NO_RECONOCIDA" });
  });
});

describe("leerPie", () => {
  it("lee la versión y la fecha ISO del pie", () => {
    expect(leerPie("v0.1 · 2025-03-23 · ficha de prueba")).toEqual({ version: "0.1", fecha: dia("2025-03-23") });
  });

  it.each(["v1 · 2025-02-30 · fecha imposible", "otra cosa", "v1 sin fecha"])("rechaza «%s»", (texto) => {
    expect(leerPie(texto)).toBeNull();
  });
});
