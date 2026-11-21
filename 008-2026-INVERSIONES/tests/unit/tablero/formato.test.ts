// Formatos de pantalla del tablero (src/app/tablero/formato.ts): deterministas, sin Intl ni Date.
import { describe, expect, it } from "vitest";
import { cop, fecha, n, numero, pct } from "@/app/tablero/formato";

const SIN_DATO = "—";

describe("n", () => {
  it("texto decimal a número; null y undefined valen 0", () => {
    expect([n("12.5"), n("-3"), n(null), n(undefined)]).toEqual([12.5, -3, 0, 0]);
  });
});

describe("cero negativo y redondeos a cero", () => {
  it("-0 se pinta sin signo en pesos, números y porcentajes", () => {
    expect([cop(-0), cop(-0, true), numero(-0), numero(-0, 2), pct(-0)]).toEqual(["$ 0", "$ 0", "0", "0,00", "0,0 %"]);
  });

  it("lo que redondea a cero no lleva signo", () => {
    expect([cop(-0.4, true), cop(0.4, true), pct(-0.04), pct(0.04), numero(-0.004, 2)]).toEqual(["$ 0", "$ 0", "0,0 %", "0,0 %", "0,00"]);
  });

  it("el signo se decide después de redondear: -0,5 redondea a −1", () => {
    expect([cop(0.5), cop(-0.5, true), cop(0.5, true)]).toEqual(["$ 1", "−$ 1", "+$ 1"]);
  });
});

describe("montos grandes", () => {
  it("miles con punto en billones y en el máximo entero exacto", () => {
    expect(cop(1_234_567_890_123)).toBe("$ 1.234.567.890.123");
    expect(cop(-987_654_321, true)).toBe("−$ 987.654.321");
    expect(cop(Number.MAX_SAFE_INTEGER)).toBe("$ 9.007.199.254.740.991");
    expect(numero(1_234_567.891, 2)).toBe("1.234.567,89");
    expect(pct(12_345.67)).toBe("+12.345,7 %");
  });

  it("justo debajo de 1e21 todavía se escribe con todos sus dígitos", () => {
    expect(cop(9.99e20)).toBe("$ 999.000.000.000.000.000.000");
  });

  it("desde 1e21 (toFixed pasa a notación exponencial) no se inventa una cifra: «—»", () => {
    expect([cop(1e21), cop(-1e21, true), numero(1e21), pct(1e21), numero(-2.5e22, 1)]).toEqual([SIN_DATO, SIN_DATO, SIN_DATO, SIN_DATO, SIN_DATO]);
  });

  it("no finitos: «—»", () => {
    expect([cop(Number.NaN), cop(Number.POSITIVE_INFINITY), numero(Number.NEGATIVE_INFINITY), pct(Number.NaN)]).toEqual([SIN_DATO, SIN_DATO, SIN_DATO, SIN_DATO]);
  });
});

describe("pct y numero", () => {
  it("porcentaje con un decimal y signo; número sin signo +", () => {
    expect([pct(12.34), pct(-7.5), numero(1234.5, 1), numero(-1234.5, 1), numero(42)]).toEqual(["+12,3 %", "−7,5 %", "1.234,5", "−1.234,5", "42"]);
  });
});

describe("fecha", () => {
  it("día ISO a «d-mes-aaaa», sin pasar por Date", () => {
    expect([fecha("2024-11-22"), fecha("2024-01-05"), fecha("2026-12-31")]).toEqual(["22-nov-2024", "5-ene-2024", "31-dic-2026"]);
  });

  it("sin dato y fechas no válidas", () => {
    expect([fecha(null), fecha(""), fecha("2024-13-01"), fecha("2024-00-10"), fecha("22/11/2024"), fecha("2024-11-22T00:00:00Z")]).toEqual([
      "sin dato", "sin dato", "fecha no válida", "fecha no válida", "fecha no válida", "fecha no válida",
    ]);
  });
});
