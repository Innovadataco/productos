// Redondeo de las métricas, orden de los textos y días del motor de análisis. Puro.
import { describe, expect, it } from "vitest";
import { diasEntre, restarMeses } from "@/analisis/dias";
import { compararTexto, DECIMALES_METRICA, redondear } from "@/analisis/numeros";

describe("redondear", () => {
  it("a 8 decimales, al múltiplo de 10⁻⁸ más cercano", () => {
    expect(DECIMALES_METRICA).toBe(8);
    expect(redondear(0.123456789)).toBe(0.12345679);
    expect(redondear(1 / 3)).toBe(0.33333333);
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(-0.987654321)).toBe(-0.98765432);
    expect(redondear(4613.27)).toBe(4613.27);
  });

  it("−0 y los restos de coma flotante salen 0 (sin signo)", () => {
    expect(Object.is(redondear(-0), 0)).toBe(true);
    expect(Object.is(redondear(-1e-12), 0)).toBe(true);
  });

  it("un número que no es finito es un error del cálculo, no una métrica", () => {
    expect(() => redondear(Number.NaN)).toThrow(RangeError);
    expect(() => redondear(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("compararTexto", () => {
  it("por unidad de código, igual en cualquier máquina", () => {
    expect(["b", "a", "á", "B", "FICTICIA-B", "FICTICIA-A"].sort(compararTexto)).toEqual(["B", "FICTICIA-A", "FICTICIA-B", "a", "b", "á"]);
    expect(compararTexto("x", "x")).toBe(0);
  });
});

describe("restarMeses", () => {
  it("el mismo día del mes, o el último si el mes es más corto", () => {
    expect(restarMeses("2021-03-31", 1)).toBe("2021-02-28");
    expect(restarMeses("2020-03-31", 1)).toBe("2020-02-29");
    expect(restarMeses("2020-02-29", 12)).toBe("2019-02-28");
    expect(restarMeses("2019-01-31", 1)).toBe("2018-12-31");
    expect(restarMeses("2021-07-15", 6)).toBe("2021-01-15");
    expect(restarMeses("2021-01-15", 3)).toBe("2020-10-15");
    expect(restarMeses("2021-08-31", 6)).toBe("2021-02-28");
    expect(restarMeses("2019-05-17", 0)).toBe("2019-05-17");
  });

  it("rechaza un día que no es AAAA-MM-DD real o meses que no son un entero no negativo", () => {
    expect(() => restarMeses("2021-02-30", 1)).toThrow(RangeError);
    expect(() => restarMeses("2021-2-3", 1)).toThrow(RangeError);
    expect(() => restarMeses("2021-03-31", -1)).toThrow(RangeError);
    expect(() => restarMeses("2021-03-31", 1.5)).toThrow(RangeError);
  });
});

describe("diasEntre", () => {
  it("días calendario, con signo", () => {
    expect(diasEntre("2021-03-01", "2021-03-15")).toBe(14);
    expect(diasEntre("2021-03-15", "2021-03-01")).toBe(-14);
    expect(diasEntre("2020-02-28", "2020-03-01")).toBe(2);
    expect(diasEntre("2019-07-04", "2019-07-04")).toBe(0);
  });

  it("rechaza un día inválido", () => {
    expect(() => diasEntre("2021-13-01", "2021-03-15")).toThrow(RangeError);
  });
});
