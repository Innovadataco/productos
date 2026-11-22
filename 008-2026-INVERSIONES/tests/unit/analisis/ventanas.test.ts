// Rendimiento en ventanas de 1, 3, 6 y 12 meses sobre la historia propia: la base en ruedas, el total con dividendos,
// la historia que no alcanza y la guarda de una sola columna. Puro.
import { describe, expect, it } from "vitest";
import { restarMeses } from "@/analisis/dias";
import { indicePrecio, rendimientosEnVentanas } from "@/analisis/ventanas";
import type { Historia } from "@/proyecciones/tipos";
import { diasHabiles, iso } from "./fixtures/portafolio.ficticio";

const FACTOR = 1.0003;

function historia(n: number, dividendos: ReadonlyMap<number, number> = new Map(), K = 1): Historia {
  const dias = diasHabiles("2019-01-02", n).map(iso);
  const T = n - 1;
  return {
    dias, T, K,
    factores: Float64Array.from({ length: T * K }, () => FACTOR),
    rendimientos: Float64Array.from({ length: T * K }, (_, t) => dividendos.get(t) ?? 0),
    ruedasPorMes: 20.9,
  };
}

/** La base esperada: el último día ≤ hasta − meses. */
const base = (dias: readonly string[], meses: number) => {
  const objetivo = restarMeses(dias.at(-1)!, meses);
  return dias.reduce((j, d, i) => (d <= objetivo ? i : j), -1);
};
const cerca = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-8);

describe("ventanas", () => {
  it("una por mes de VENTANAS_MESES, desde la última rueda en o antes del mismo día meses atrás", () => {
    const h = historia(400);
    const v = rendimientosEnVentanas(h);
    expect(v.map((x) => x.meses)).toEqual([1, 3, 6, 12]);
    for (const x of v) {
      if (x.estado !== "CALCULADA") throw new Error(`la ventana de ${x.meses} meses debía alcanzar`);
      const b = base(h.dias, x.meses);
      expect(x).toMatchObject({ desde: h.dias[b], hasta: h.dias.at(-1), ruedas: h.dias.length - 1 - b });
      cerca(x.precio, FACTOR ** x.ruedas - 1);
      cerca(x.total, FACTOR ** x.ruedas - 1);
    }
  });

  it("el total suma el dividendo del día del pago, reinvertido; el precio no", () => {
    const h = historia(400, new Map([[393, 0.0123]]));
    const un = rendimientosEnVentanas(h)[0]!;
    if (un.estado !== "CALCULADA") throw new Error("debía alcanzar");
    cerca(un.precio, FACTOR ** un.ruedas - 1);
    cerca(un.total, (FACTOR ** un.ruedas * (FACTOR + 0.0123)) / FACTOR - 1);
  });

  it("con 260 ruedas la de 12 meses no alcanza; las demás sí", () => {
    expect(rendimientosEnVentanas(historia(260)).map((x) => x.estado)).toEqual(["CALCULADA", "CALCULADA", "CALCULADA", "HISTORIA_NO_ALCANZA"]);
  });

  it("si el objetivo es una rueda, la base es ese mismo día", () => {
    const casos = Array.from({ length: 30 }, (_, j) => historia(300 + j)).filter((h) => h.dias.includes(restarMeses(h.dias.at(-1)!, 3)));
    expect(casos.length).toBeGreaterThan(0);
    for (const h of casos) {
      const v = rendimientosEnVentanas(h)[1]!;
      expect(v.estado === "CALCULADA" ? v.desde : null).toBe(restarMeses(h.dias.at(-1)!, 3));
    }
  });

  it("el índice de precio empieza en 1 y multiplica los factores", () => {
    const i = indicePrecio(historia(4));
    expect(i[0]).toBe(1);
    cerca(i[3]!, FACTOR ** 3);
  });

  it("solo con una columna", () => {
    expect(() => rendimientosEnVentanas(historia(10, new Map(), 2))).toThrow(RangeError);
    expect(() => indicePrecio(historia(10, new Map(), 2))).toThrow(RangeError);
  });
});
