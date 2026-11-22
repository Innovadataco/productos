// Riesgo de un portafolio con resultados conocidos, a mano: correlación +1 y −1, una sola especie, pesos iguales, una
// columna que no varía y las guardas. Puro.
import { describe, expect, it } from "vitest";
import { correlacionDe, covarianzaMuestral, descomponerRiesgo, DESVIACION_DIARIA_MINIMA, toleranciaSuma, VOLATILIDAD_MINIMA } from "@/analisis/riesgo";
import { desviacion } from "@/proyecciones/estadistica";
import { RETORNOS_BASE } from "./fixtures/portafolio.ficticio";

const A = 243.7;
const rA = [...RETORNOS_BASE];
const s = desviacion(rA);
const v = s * Math.sqrt(A);
const cerca = (a: number | null, b: number, rel = 1e-12) => {
  expect(a).not.toBeNull();
  expect(Math.abs(a! - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));
};

describe("covarianza muestral", () => {
  it("la varianza de una columna es la desviación de estadistica.ts al cuadrado (n − 1)", () => {
    cerca(covarianzaMuestral([rA])[0]![0]!, s ** 2);
  });

  it("es simétrica", () => {
    const cov = covarianzaMuestral([rA, rA.map((x, j) => x * (j % 2 === 0 ? 3 : -1))]);
    expect(cov[0]![1]).toBe(cov[1]![0]);
  });

  it("sin columnas da una matriz vacía", () => {
    expect(covarianzaMuestral([])).toEqual([]);
  });

  it("rechaza menos de dos retornos o columnas de largo distinto", () => {
    expect(() => covarianzaMuestral([[0.0123]])).toThrow(RangeError);
    expect(() => covarianzaMuestral([rA, rA.slice(1)])).toThrow(RangeError);
  });
});

describe("correlación +1: B = 2 × A, pesos iguales", () => {
  const cov = covarianzaMuestral([rA, rA.map((x) => 2 * x)]);
  const d = descomponerRiesgo(cov, [0.5, 0.5], A);

  it("ρ = 1 y la diagonal es 1", () => {
    const rho = correlacionDe(cov);
    expect(rho[0]![0]).toBe(1);
    expect(rho[1]![1]).toBe(1);
    cerca(rho[0]![1]!, 1);
    expect(rho[0]![1]).toBe(rho[1]![0]);
  });

  it("σp = 1,5 s√A; marginal = s√A y 2 s√A; contribuciones 1/3 y 2/3", () => {
    cerca(d.volatilidad, 1.5 * v);
    cerca(d.columnas[0]!.volatilidad, v);
    cerca(d.columnas[1]!.volatilidad, 2 * v);
    cerca(d.columnas[0]!.marginal, v);
    cerca(d.columnas[1]!.marginal, 2 * v);
    cerca(d.columnas[0]!.contribucion, 0.5 * v);
    cerca(d.columnas[1]!.contribucion, v);
    cerca(d.columnas[0]!.contribucionPct, 1 / 3);
    cerca(d.columnas[1]!.contribucionPct, 2 / 3);
  });
});

describe("correlación −1: B = −A", () => {
  const cov = covarianzaMuestral([rA, rA.map((x) => -x)]);

  it("ρ = −1", () => {
    cerca(correlacionDe(cov)[0]![1]!, -1);
  });

  it("con pesos iguales el riesgo se anula: σp = 0 y no hay contribuciones que repartir", () => {
    const d = descomponerRiesgo(cov, [0.5, 0.5], A);
    expect(d.volatilidad).toBe(0);
    expect(d.columnas.map((c) => [c.marginal, c.contribucion, c.contribucionPct])).toEqual([[null, null, null], [null, null, null]]);
    cerca(d.columnas[0]!.volatilidad, v);
  });

  it("con pesos 0,75 y 0,25: σp = 0,5 s√A y la contribución de B es negativa", () => {
    const d = descomponerRiesgo(cov, [0.75, 0.25], A);
    cerca(d.volatilidad, 0.5 * v);
    cerca(d.columnas[0]!.marginal, v);
    cerca(d.columnas[1]!.marginal, -v);
    cerca(d.columnas[0]!.contribucion, 0.75 * v);
    cerca(d.columnas[1]!.contribucion, -0.25 * v);
    cerca(d.columnas[0]!.contribucionPct, 1.5);
    cerca(d.columnas[1]!.contribucionPct, -0.5);
  });
});

describe("una sola especie", () => {
  it("su contribución es toda la volatilidad", () => {
    const cov = covarianzaMuestral([rA]);
    const d = descomponerRiesgo(cov, [1], A);
    cerca(d.volatilidad, v);
    cerca(d.columnas[0]!.contribucion, v);
    cerca(d.columnas[0]!.contribucionPct, 1);
    cerca(d.columnas[0]!.marginal, v);
    expect(correlacionDe(cov)).toEqual([[1]]);
  });
});

describe("una columna que no varía", () => {
  const constante = [0, 0, 0, 0, 0];
  const ruido = [1e-13, -1e-13, 1e-13, -1e-13, 0];

  it("su correlación es null, también en la diagonal; su volatilidad y su contribución, 0", () => {
    const cov = covarianzaMuestral([rA, constante]);
    expect(correlacionDe(cov)).toEqual([[1, null], [null, null]]);
    const d = descomponerRiesgo(cov, [0.6, 0.4], A);
    cerca(d.volatilidad, 0.6 * v);
    expect(d.columnas[1]!.volatilidad).toBe(0);
    expect(d.columnas[1]!.contribucion).toBe(0);
    cerca(d.columnas[0]!.contribucionPct, 1);
  });

  it("un ruido de coma flotante por debajo del mínimo tampoco varía", () => {
    expect(desviacion(ruido)).toBeLessThan(DESVIACION_DIARIA_MINIMA);
    expect(correlacionDe(covarianzaMuestral([rA, ruido]))[0]![1]).toBeNull();
  });

  it("sin ninguna columna que varíe, σp = 0", () => {
    const d = descomponerRiesgo(covarianzaMuestral([constante]), [1], A);
    expect(d.volatilidad).toBe(0);
    expect(d.columnas[0]!.contribucion).toBeNull();
  });
});

describe("guardas y tolerancias", () => {
  const cov = covarianzaMuestral([rA, rA.map((x) => 2 * x)]);

  it("los pesos deben ser tantos como las columnas, no negativos y sumar 1", () => {
    expect(() => descomponerRiesgo(cov, [1], A)).toThrow(RangeError);
    expect(() => descomponerRiesgo(cov, [1.2, -0.2], A)).toThrow(RangeError);
    expect(() => descomponerRiesgo(cov, [0.5, 0.4], A)).toThrow(RangeError);
    expect(() => descomponerRiesgo(cov, [Number.NaN, 1], A)).toThrow(RangeError);
  });

  it("el factor de anualización debe ser positivo y finito", () => {
    expect(() => descomponerRiesgo(cov, [0.5, 0.5], 0)).toThrow(RangeError);
    expect(() => descomponerRiesgo(cov, [0.5, 0.5], Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("la tolerancia de la suma es (K + 1) × 10⁻⁸ y los mínimos son los documentados", () => {
    expect(toleranciaSuma(1)).toBe(2e-8);
    expect(toleranciaSuma(9)).toBeCloseTo(1e-7, 20);
    expect(DESVIACION_DIARIA_MINIMA).toBe(1e-10);
    expect(VOLATILIDAD_MINIMA).toBe(1e-12);
  });
});
