// Caída máxima con resultados conocidos: la mayor caída desde un pico, el empate, sin caída y los bordes. Puro.
import { describe, expect, it } from "vitest";
import { caidaMaxima } from "@/analisis/caida";

const dias = ["2019-03-04", "2019-03-05", "2019-03-06", "2019-03-07", "2019-03-08"];

describe("caída máxima", () => {
  it("la mayor caída desde un máximo previo: 25 % del día 1 al día 2 (la de 20 % después no gana)", () => {
    // 1484,88 × 0,75 = 1113,66 y 1608,62 × 0,8 = 1286,896.
    expect(caidaMaxima(dias, [1237.4, 1484.88, 1113.66, 1608.62, 1286.896])).toEqual({ estado: "CAIDA", fraccion: 0.25, pico: dias[1], valle: dias[2] });
  });

  it("en un empate gana la primera: el pico no se mueve con un máximo igual", () => {
    expect(caidaMaxima(dias, [1237.4, 2474.8, 1856.1, 2474.8, 1856.1])).toEqual({ estado: "CAIDA", fraccion: 0.25, pico: dias[1], valle: dias[2] });
  });

  it("una serie que solo sube, un solo día o ninguno: sin caída", () => {
    expect(caidaMaxima(dias.slice(0, 3), [1237.4, 1484.88, 1608.62])).toEqual({ estado: "SIN_CAIDA" });
    expect(caidaMaxima(dias.slice(0, 1), [1237.4])).toEqual({ estado: "SIN_CAIDA" });
    expect(caidaMaxima([], [])).toEqual({ estado: "SIN_CAIDA" });
  });

  it("una caída que redondea a 0 a 8 decimales es sin caída", () => {
    expect(caidaMaxima(dias.slice(0, 2), [1, 1 - 1e-12])).toEqual({ estado: "SIN_CAIDA" });
  });

  it("rechaza largos distintos o un índice que no es positivo y finito", () => {
    expect(() => caidaMaxima(dias, [1, 2])).toThrow(RangeError);
    expect(() => caidaMaxima(dias.slice(0, 2), [1, 0])).toThrow(RangeError);
    expect(() => caidaMaxima(dias.slice(0, 2), [1, Number.NaN])).toThrow(RangeError);
  });
});
