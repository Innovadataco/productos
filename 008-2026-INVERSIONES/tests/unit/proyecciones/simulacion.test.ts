// Núcleo del bootstrap por bloques (circular, bloque fijo) sobre historias armadas a mano. Puro y reproducible.
import { describe, expect, it } from "vitest";
import { BLOQUE } from "@/proyecciones/metodo";
import { simular } from "@/proyecciones/simulacion";
import type { ParametrosProyeccion, PuntoProyeccion } from "@/proyecciones/tipos";
import { azarDePrueba, historiaConstante, historiaDe } from "./ficticio";

const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 24, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 37, semilla: 4613, ...cambios,
});
const cartera = (valores: number[], fijo = 0) => ({ valores: Float64Array.from(valores), fijo });
const cerca = (a: number, b: number, rel = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));
const bandas = (p: PuntoProyeccion) => [p.p5, p.p25, p.p50, p.p75, p.p95];

/** Historia «de verdad» (aleatoria) de T días y K columnas, con algún dividendo. */
function historiaAleatoria(T: number, K: number, semilla: number) {
  const azar = azarDePrueba(semilla);
  const f = Array.from({ length: T }, () => Array.from({ length: K }, () => 1 + (azar() - 0.49) * 0.05));
  const y = Array.from({ length: T }, (_, t) => Array.from({ length: K }, () => (t % 61 === 7 ? 0.013 : 0)));
  return historiaDe(f, 20.37, y);
}

describe("simular · propiedades", () => {
  it("el bloque por defecto es de 20 ruedas", () => {
    expect(BLOQUE).toBe(20);
  });

  it("con volatilidad cero el resultado es determinista: todas las bandas iguales y la mediana = V0·g^round(m·R)", () => {
    const g = 1.000731;
    const R = 20.61;
    const s = simular(historiaConstante(43, 1, g, R), cartera([4613.27]), P());
    expect(s.puntos).toHaveLength(25);
    for (const p of s.puntos) {
      const esperado = 4613.27 * g ** Math.round(p.mes * R);
      for (const b of bandas(p)) cerca(b, esperado);
      expect(p.aportado).toBe(4613.27);
    }
    expect(s.probabilidadBajoAportado).toBe(0);
    expect(s.caidaMaximaMediana).toBe(0);
  });

  it("los percentiles quedan ordenados en cada punto (20 semillas)", () => {
    const h = historiaAleatoria(311, 3, 17);
    for (let semilla = 1; semilla <= 20; semilla += 1) {
      const s = simular(h, cartera([1237.4, 3311.9, 907.13]), P({ semilla, trayectorias: 53, horizonteMeses: 13 }));
      for (const p of s.puntos) {
        const b = bandas(p);
        expect([...b].sort((x, y) => x - y)).toEqual(b);
      }
    }
  });

  it("la misma semilla da exactamente lo mismo; otra semilla, otra cosa", () => {
    const h = historiaAleatoria(257, 2, 29);
    const c = cartera([4613.27, 791.3]);
    expect(simular(h, c, P({ semilla: 37 }))).toEqual(simular(h, c, P({ semilla: 37 })));
    expect(simular(h, c, P({ semilla: 37 }))).not.toEqual(simular(h, c, P({ semilla: 38 })));
  });

  it("sortea el MISMO día para todas las columnas: dos columnas iguales valen lo que una con la suma", () => {
    const azar = azarDePrueba(41);
    const filas = Array.from({ length: 263 }, () => 1 + (azar() - 0.5) * 0.06);
    const dos = historiaDe(filas.map((f) => [f, f]), 20.9);
    const una = historiaDe(filas.map((f) => [f]), 20.9);
    const a = simular(dos, cartera([1237.41, 3376.59]), P({ trayectorias: 211 }));
    const b = simular(una, cartera([4614]), P({ trayectorias: 211 }));
    a.puntos.forEach((p, m) => bandas(p).forEach((x, j) => cerca(x, bandas(b.puntos[m]!)[j]!)));
  });

  it("los bloques son de días consecutivos: una serie de período 2 no se dispersa con bloque 20 y sí con bloque 1", () => {
    const filas = Array.from({ length: 40 }, (_, t) => [t % 2 === 0 ? 1.0213 : 1 / 1.0213]);
    const h = historiaDe(filas, 20);
    const con20 = simular(h, cartera([4613]), P({ trayectorias: 97, horizonteMeses: 6 }));
    for (const p of con20.puntos) for (const b of bandas(p)) cerca(b, 4613);
    const con1 = simular(h, cartera([4613]), P({ trayectorias: 97, horizonteMeses: 6 }), { bloque: 1 });
    const ultimo = con1.puntos.at(-1)!;
    expect(ultimo.p95 - ultimo.p5).toBeGreaterThan(100);
  });

  it("horizonte 0: un solo punto, el de hoy (con la caída ya aplicada)", () => {
    const s = simular(historiaAleatoria(271, 1, 3), cartera([4613.27]), P({ horizonteMeses: 0, caidaInicialPct: 17.3 }));
    expect(s.puntos).toHaveLength(1);
    for (const b of bandas(s.puntos[0]!)) cerca(b, 4613.27 * (1 - 0.173));
    expect(s.puntos[0]).toMatchObject({ mes: 0, aportado: 4613.27, dividendosP50: 0 });
    expect(s.probabilidadBajoAportado).toBe(1);
    cerca(s.caidaMaximaMediana, 0.173);
  });

  it("sin historia (K = 0) lo fijo queda fijo y no se sortea nada", () => {
    const s = simular(historiaDe([], 0), cartera([], 3719.41), P({ horizonteMeses: 5 }));
    for (const p of s.puntos) for (const b of bandas(p)) expect(b).toBe(3719.41);
    expect(s.caidaMaximaMediana).toBe(0);
  });

  it("una historia con columnas pero sin días no se puede simular", () => {
    expect(() => simular({ ...historiaDe([], 21), K: 2 }, cartera([1, 2]), P())).toThrow(RangeError);
    expect(() => simular(historiaConstante(30, 2, 1, 21), cartera([1]), P())).toThrow(RangeError);
  });
});
