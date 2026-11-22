// Formatos de las gráficas (frente graficas-tablero): deterministas, sin Intl ni Date, como el resto de formato.ts.
import { describe, expect, it } from "vitest";
import { copCompacto, etiquetaTick, pctEje } from "@/app/tablero/formato";

describe("copCompacto (ejes)", () => {
  it.each([
    [0, "$ 0"], [947, "$ 947"], [4613, "$ 4,6 mil"], [262500, "$ 262,5 mil"], [268000, "$ 268 mil"],
    [1250000, "$ 1,25 M"], [12000000, "$ 12 M"], [-37911.47, "−$ 37,9 mil"], [Number.NaN, "—"],
  ])("%s → %s", (v, texto) => {
    expect(copCompacto(v)).toBe(texto);
  });
});

describe("pctEje", () => {
  it.each([[0, "0 %"], [2.5, "+2,5 %"], [-1, "−1 %"], [12.25, "+12,3 %"], [Number.POSITIVE_INFINITY, "—"]])("%s → %s", (v, texto) => {
    expect(pctEje(v)).toBe(texto);
  });
});

describe("etiquetaTick", () => {
  it("mes, con el año solo cuando se pide; día con su mes", () => {
    expect(etiquetaTick("2027-03-01", { tipo: "mes", conAnio: false })).toBe("mar");
    expect(etiquetaTick("2027-01-01", { tipo: "mes", conAnio: true })).toBe("ene 2027");
    expect(etiquetaTick("2027-03-15", { tipo: "dia", conAnio: false })).toBe("15 mar");
    expect(etiquetaTick("2027-03-15", { tipo: "dia", conAnio: true })).toBe("15 mar 2027");
    expect(etiquetaTick("no-es-dia", { tipo: "dia", conAnio: false })).toBe("—");
  });
});
