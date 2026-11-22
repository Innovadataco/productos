// El escenario del usuario sobre el bootstrap: aportes, caída inicial, dividendos (reinvertidos o cobrados),
// caída máxima sin el efecto de los aportes, la parte fija y el caso sin nada valorado. Puro.
import { describe, expect, it } from "vitest";
import { simular } from "@/proyecciones/simulacion";
import type { ParametrosProyeccion } from "@/proyecciones/tipos";
import { historiaConstante, historiaDe } from "./ficticio";

const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 7, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 29, semilla: 7919, ...cambios,
});
const cartera = (valores: number[], fijo = 0) => ({ valores: Float64Array.from(valores), fijo });
const cerca = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe("simular · escenario", () => {
  it("aportes trimestrales: al final de los meses 3, 6, …; lo aportado incluye el valor de hoy", () => {
    const s = simular(historiaConstante(37, 1, 1, 21), cartera([4613.27]), P({ aportePeriodico: 37.91, frecuenciaAporte: "TRIMESTRAL" }));
    expect(s.puntos.map((p) => p.aportado)).toEqual([0, 0, 0, 1, 1, 1, 2, 2].map((n) => 4613.27 + n * 37.91));
    s.puntos.forEach((p) => cerca(p.p50, p.aportado));
  });

  it("aportes anuales y semestrales cuentan por meses", () => {
    const anual = simular(historiaConstante(37, 1, 1, 21), cartera([100.3]), P({ horizonteMeses: 25, aportePeriodico: 7.13, frecuenciaAporte: "ANUAL" }));
    expect(anual.puntos.at(-1)!.aportado).toBeCloseTo(100.3 + 2 * 7.13, 9);
    const semestral = simular(historiaConstante(37, 1, 1, 21), cartera([100.3]), P({ horizonteMeses: 13, aportePeriodico: 7.13, frecuenciaAporte: "SEMESTRAL" }));
    expect(semestral.puntos.at(-1)!.aportado).toBeCloseTo(100.3 + 2 * 7.13, 9);
  });

  it("caída inicial del 30 % sin volatilidad: el punto 0 ya cae, la probabilidad es 1 y la caída máxima mediana 0,30", () => {
    const v0 = 2873.59 + 1469.83;
    const s = simular(historiaConstante(37, 2, 1, 21), cartera([2873.59, 1469.83]), P({ caidaInicialPct: 30 }));
    cerca(s.puntos[0]!.p50, 0.7 * v0);
    cerca(s.puntos.at(-1)!.p95, 0.7 * v0);
    expect(s.probabilidadBajoAportado).toBe(1);
    cerca(s.caidaMaximaMediana, 0.3);
  });

  it("sin reinvertir: el dividendo sale del valor, se acumula aparte y cuenta en la probabilidad", () => {
    const R = 21;
    const s = simular(historiaConstante(37, 1, 0.9995, R, 0.001), cartera([4613.27]), P({ reinvertirDividendos: false }));
    let v = 4613.27;
    let cobrado = 0;
    for (let d = 1; d <= Math.round(7 * R); d += 1) {
      cobrado += v * 0.001;
      v *= 0.9995;
    }
    const ultimo = s.puntos.at(-1)!;
    cerca(ultimo.p50, v);
    cerca(ultimo.dividendosP50, cobrado);
    expect(ultimo.p50).toBeLessThan(ultimo.aportado);
    expect(ultimo.p50 + ultimo.dividendosP50).toBeGreaterThan(ultimo.aportado);
    expect(s.probabilidadBajoAportado).toBe(0); // el valor queda abajo, pero con lo cobrado no
  });

  it("reinvirtiendo: el dividendo queda en la misma especie y los dividendos acumulados son exactos", () => {
    const R = 21;
    const s = simular(historiaConstante(37, 1, 1, R, 0.001), cartera([4613.27]), P());
    for (const p of s.puntos) {
      const n = Math.round(p.mes * R);
      cerca(p.p50, 4613.27 * 1.001 ** n);
      cerca(p.dividendosP50, 4613.27 * (1.001 ** n - 1));
    }
  });

  it("la caída máxima se mide sin los aportes (índice tipo TWR): aportes grandes no la tapan", () => {
    const s = simular(historiaConstante(37, 1, 0.98, 20), cartera([4613.27]), P({ horizonteMeses: 3, aportePeriodico: 46_132.7 }));
    expect(s.puntos.at(-1)!.p50).toBeGreaterThan(s.puntos[0]!.p50);
    cerca(s.caidaMaximaMediana, 1 - 0.98 ** 60);
  });

  it("la parte fija no se mueve pero recibe su parte de los aportes (pesos de hoy)", () => {
    const R = 20;
    const s = simular(historiaConstante(37, 1, 1.01, R), cartera([2873.59], 917.43), P({ horizonteMeses: 4, aportePeriodico: 487.29 }));
    const total = 2873.59 + 917.43;
    let columna = 2873.59;
    let fijo = 917.43;
    for (let m = 1; m <= 4; m += 1) {
      columna *= 1.01 ** R;
      columna += 487.29 * (2873.59 / total);
      fijo += 487.29 * (917.43 / total);
    }
    cerca(s.puntos.at(-1)!.p50, columna + fijo);
  });

  it("dos columnas distintas (factor, dividendo y peso propios) cuadran con la cuenta cerrada por columna", () => {
    const R = 20;
    const filas = Array.from({ length: 23 }, () => [1.0021, 0.9987]);
    const divs = Array.from({ length: 23 }, () => [0, 0.0013]);
    const s = simular(historiaDe(filas, R, divs), cartera([2873.59, 1469.83], 203.77), P({ horizonteMeses: 5, aportePeriodico: 371.53, reinvertirDividendos: false }));
    const total = 2873.59 + 1469.83 + 203.77;
    const v = [2873.59, 1469.83];
    let fijo = 203.77;
    let cobrado = 0;
    for (let m = 1; m <= 5; m += 1) {
      for (let d = 0; d < R; d += 1) {
        cobrado += v[1]! * 0.0013;
        v[0] = v[0]! * 1.0021;
        v[1] = v[1]! * 0.9987;
      }
      v[0] = v[0]! + 371.53 * (2873.59 / total);
      v[1] = v[1]! + 371.53 * (1469.83 / total);
      fijo += 371.53 * (203.77 / total);
    }
    cerca(s.puntos.at(-1)!.p50, v[0]! + v[1]! + fijo);
    cerca(s.puntos.at(-1)!.dividendosP50, cobrado);
  });

  it("sin reinvertir, el dividendo cobrado cuenta en el índice de la caída máxima (no es una caída)", () => {
    const s = simular(historiaConstante(37, 1, 0.999, 21, 0.001), cartera([4613.27]), P({ reinvertirDividendos: false }));
    expect(s.caidaMaximaMediana).toBeLessThan(1e-12);
    const conCaida = simular(historiaConstante(37, 1, 0.999, 21, 0), cartera([4613.27]), P({ reinvertirDividendos: false }));
    cerca(conCaida.caidaMaximaMediana, 1 - 0.999 ** Math.round(7 * 21));
  });

  it("sin nada valorado, los aportes se suman sin retorno", () => {
    const s = simular(historiaDe([], 0), cartera([], 0), P({ horizonteMeses: 3, aportePeriodico: 41.3 }));
    s.puntos.forEach((p, m) => {
      cerca(p.p50, 41.3 * m);
      cerca(p.aportado, 41.3 * m);
    });
    expect(s.probabilidadBajoAportado).toBe(0);
  });
});
