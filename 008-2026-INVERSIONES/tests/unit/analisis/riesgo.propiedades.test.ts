// Propiedades del riesgo con semilla (crearPrng de src/proyecciones/prng.ts, sin modificar): las contribuciones suman
// la volatilidad, la correlación queda en [−1, 1] con la diagonal en 1, y la matriz es simétrica. Puro.
import { describe, expect, it } from "vitest";
import { correlacionDe, covarianzaMuestral, descomponerRiesgo, VOLATILIDAD_MINIMA } from "@/analisis/riesgo";
import { crearPrng } from "@/proyecciones/prng";

interface Caso {
  readonly columnas: number[][];
  readonly pesos: number[];
  readonly constante: number | null;
}

/** K columnas de T retornos con un factor común (para que haya correlación) y, en algunas semillas, una constante. */
function caso(semilla: number): Caso {
  const p = crearPrng(semilla);
  const K = 1 + p.enteroMenorQue(8);
  const T = 250 + p.enteroMenorQue(150);
  const betas = Array.from({ length: K }, () => (p.uniforme() - 0.3) * 2);
  const comun = Array.from({ length: T }, () => (p.uniforme() - 0.5) * 0.03);
  const constante = semilla % 7 === 0 ? p.enteroMenorQue(K) : null;
  const columnas = betas.map((b, k) => comun.map((f) => (k === constante ? 0 : b * f + (p.uniforme() - 0.5) * 0.04)));
  const crudos = Array.from({ length: K }, () => p.uniforme() + 0.01);
  const total = crudos.reduce((a, x) => a + x, 0);
  return { columnas, pesos: crudos.map((x) => x / total), constante };
}

const SEMILLAS = Array.from({ length: 60 }, (_, j) => j + 1);

describe("propiedades del riesgo (60 semillas)", () => {
  it("las contribuciones suman la volatilidad del portafolio y las porcentuales suman 1", () => {
    for (const semilla of SEMILLAS) {
      const { columnas, pesos, constante } = caso(semilla);
      const d = descomponerRiesgo(covarianzaMuestral(columnas), pesos, 12 * 20.3);
      if (columnas.length === 1 && constante !== null) {
        expect(d.volatilidad).toBe(0);
        expect(d.columnas[0]!.contribucion).toBeNull();
        continue;
      }
      expect(d.volatilidad).toBeGreaterThan(VOLATILIDAD_MINIMA);
      const suma = d.columnas.reduce((a, c) => a + c.contribucion!, 0);
      const pct = d.columnas.reduce((a, c) => a + c.contribucionPct!, 0);
      expect(Math.abs(suma - d.volatilidad), `semilla ${semilla}`).toBeLessThanOrEqual(1e-12);
      expect(Math.abs(pct - 1), `semilla ${semilla}`).toBeLessThanOrEqual(1e-12);
    }
  });

  it("la correlación queda en [−1, 1], la diagonal es 1, es simétrica y es null solo con una columna que no varía", () => {
    for (const semilla of SEMILLAS) {
      const { columnas, constante } = caso(semilla);
      const rho = correlacionDe(covarianzaMuestral(columnas));
      rho.forEach((fila, i) =>
        fila.forEach((r, j) => {
          expect(r, `semilla ${semilla} (${i}, ${j})`).toBe(rho[j]![i]);
          if (i === constante || j === constante) return expect(r).toBeNull();
          expect(r).not.toBeNull();
          if (i === j) return expect(r).toBe(1);
          expect(r!).toBeGreaterThanOrEqual(-1);
          expect(r!).toBeLessThanOrEqual(1);
        }),
      );
    }
  });
});
