// PRNG del motor de proyecciones: xoshiro128** 1.1 sembrado con SplitMix64 (Blackman y Vigna, dominio público,
// prng.di.unimi.it). Los vectores dorados salen del C de referencia compilado fuera del repo (cc -O2), con la
// misma siembra: dos salidas de SplitMix64 desde la semilla, partidas en palabras baja y alta. Puro.
import { describe, expect, it } from "vitest";
import { crearPrng, splitmix64 } from "@/proyecciones/prng";

const primeros = (semilla: number, n: number) => {
  const g = crearPrng(semilla);
  return Array.from({ length: n }, () => g.siguiente());
};

describe("SplitMix64", () => {
  it("desde 0 da la secuencia publicada de la referencia", () => {
    const a = splitmix64(0n);
    const b = splitmix64(a.estado);
    const c = splitmix64(b.estado);
    expect([a.salida, b.salida, c.salida].map((x) => x.toString(16).padStart(16, "0"))).toEqual(["e220a8397b1dcdaf", "6e789e6aa1b965f4", "06c45d188009454f"]);
  });
});

describe("xoshiro128**", () => {
  it("coincide con el C de referencia en tres semillas (0, 4613 y 2^32 − 1)", () => {
    expect(primeros(0, 6)).toEqual([3737715805, 2584255861, 2876756834, 3286328325, 1553311962, 1625202774]);
    expect(primeros(4613, 6)).toEqual([580957937, 2871067263, 2089021367, 2212750158, 2923131573, 3977756082]);
    expect(primeros(4294967295, 6)).toEqual([331202089, 2303545133, 2732085799, 1755962312, 20464611, 435992899]);
  });

  it("la misma semilla repite la secuencia y otra semilla la cambia", () => {
    expect(primeros(7919, 50)).toEqual(primeros(7919, 50));
    expect(primeros(7919, 50)).not.toEqual(primeros(7920, 50));
  });

  it("uniforme queda en [0, 1)", () => {
    const g = crearPrng(31337);
    const u = Array.from({ length: 5000 }, () => g.uniforme());
    expect(Math.min(...u)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...u)).toBeLessThan(1);
  });

  it("enteroMenorQue da enteros en [0, n) y reparte parejo (chi-cuadrado, 9 grados, p = 0,001)", () => {
    const g = crearPrng(2027);
    const cubetas = new Array<number>(10).fill(0);
    const n = 23_117;
    for (let i = 0; i < n; i += 1) {
      const x = g.enteroMenorQue(10);
      expect(Number.isInteger(x) && x >= 0 && x < 10).toBe(true);
      cubetas[x]! += 1;
    }
    const esperado = n / 10;
    const chi = cubetas.reduce((s, c) => s + (c - esperado) ** 2 / esperado, 0);
    expect(chi).toBeLessThan(27.88);
    expect(crearPrng(5).enteroMenorQue(1)).toBe(0);
  });

  it("rechaza semillas que no son enteros de 32 bits y n que no es entero positivo", () => {
    for (const s of [-1, 1.5, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => crearPrng(s)).toThrow(RangeError);
    const g = crearPrng(3);
    for (const n of [0, -4, 2.5, Number.NaN, 2 ** 32 + 1]) expect(() => g.enteroMenorQue(n)).toThrow(RangeError);
  });
});
