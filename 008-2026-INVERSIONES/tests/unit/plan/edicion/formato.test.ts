// Formato es-CO de los valores que el formulario del plan precarga (fase B, PR-B): el nivel y la cantidad de la base se
// escriben como los lee la ficha (src/plan/importar/valores-es.ts), sin pasar por punto flotante, y vuelven idénticos al
// leerlos. Puro. Datos inventados.
import { describe, expect, it } from "vitest";
import { cantidadEs, nivelEs } from "@/plan/edicion/formato";
import { leerEnteroEs, leerMontoEs } from "@/plan/importar/valores-es";

describe("nivelEs", () => {
  it.each([
    ["1237.5", "1.237,5"],
    ["1200.000000", "1.200"],
    ["9.500000", "9,5"],
    ["0.000001", "0,000001"],
    ["37911.47", "37.911,47"],
    ["12345678901234.123456", "12.345.678.901.234,123456"],
    ["613", "613"],
  ])("%s → %s", (decimal, es) => {
    expect(nivelEs(decimal)).toBe(es);
  });

  it("ida y vuelta exacta con la lectura de la ficha (sin redondeos)", () => {
    for (const d of ["1237.5", "9.5", "0.000001", "37911.47", "12345678901234.123456", "4613"]) expect(leerMontoEs(nivelEs(d))).toBe(d);
  });

  it("un texto que no es decimal canónico queda vacío (no se precarga basura)", () => {
    for (const malo of ["", "abc", "1e5", "-3", "1,5"]) expect(nivelEs(malo)).toBe("");
  });
});

describe("cantidadEs", () => {
  it("miles con punto, ida y vuelta con la ficha", () => {
    expect(cantidadEs(4613n)).toBe("4.613");
    expect(cantidadEs(37n)).toBe("37");
    expect(cantidadEs(9223372036854775807n)).toBe("9.223.372.036.854.775.807");
    for (const v of [4613n, 37n, 1237911n]) expect(leerEnteroEs(cantidadEs(v))).toBe(v);
  });
});
