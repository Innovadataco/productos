// La proyección completa (pura): de las entradas leídas al resultado serializable, con su aviso, sus supuestos y la
// mediana que se espera en series sintéticas.
import { describe, expect, it } from "vitest";
import { calcularProyeccion } from "@/proyecciones/calcular";
import { AVISO, type ParametrosProyeccion } from "@/proyecciones/tipos";
import { accion, diasHabiles, entradas, fondo, iso, serieAleatoria, valoresDiarios } from "./ficticio";

const P = (cambios: Partial<ParametrosProyeccion> = {}): ParametrosProyeccion => ({
  horizonteMeses: 12, aportePeriodico: 0, frecuenciaAporte: "MENSUAL", reinvertirDividendos: true, caidaInicialPct: 0, trayectorias: 2311, semilla: 4613, ...cambios,
});

describe("calcularProyeccion", () => {
  const dias = diasHabiles("2017-01-03", 900);
  const a = serieAleatoria(dias, 1237.4, 19, 0.0004, 0.015);

  it("con aporte 0 y caída 0, la mediana coincide con lo esperado: V0 · exp(n · media del log-retorno)", () => {
    const r = calcularProyeccion(entradas([accion("a", 37, a)]), P());
    const logs = a.slice(1).map((c, j) => Math.log(c.precio / a[j]!.precio));
    const mediaLog = logs.reduce((s, x) => s + x, 0) / logs.length;
    const n = Math.round(12 * r.supuestos.ruedasPorMes);
    const esperado = 37 * a.at(-1)!.precio * Math.exp(n * mediaLog);
    expect(Math.abs(r.puntos.at(-1)!.p50 / esperado - 1)).toBeLessThan(0.02);
  });

  it("trae el aviso, el valor de hoy, un punto por mes y los parámetros usados", () => {
    const vu = valoresDiarios("2016-12-01", 1300, 12_731.4419, 1.00013);
    const e = entradas([accion("a", 37, a), fondo("f", 1499.927, vu)]);
    const r = calcularProyeccion(e, P({ horizonteMeses: 7 }));
    expect(r.aviso).toBe(AVISO);
    expect(AVISO).toBe("Escenario ilustrativo, no es recomendación ni promesa.");
    expect(r.puntos.map((p) => p.mes)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(r.valorHoy).toBeCloseTo(37 * a.at(-1)!.precio + 1499.927 * vu.at(-1)!.valorUnidad, 6);
    expect(r.parametros).toEqual(P({ horizonteMeses: 7 }));
    expect(r.hoy).toBe(iso(e.hoy));
    expect(r.supuestos.fraccionProyectada).toBe(1);
    // v2: los pagos de Trii con decreto se miden con su fecha ex (la regla del plan); con decretos, los mismos datos
    // dan otro resultado que la v1, así que la versión lo dice. Sin decretos, los números son los de la v1.
    expect(r.versionMetodo).toBe("bootstrap-circular-v2");
    expect(calcularProyeccion(e, P({ horizonteMeses: 7 }))).toEqual(r);
  });

  it("con parte fija: la fracción proyectada es la del valor con riesgo modelado", () => {
    const e = entradas([accion("a", 37, a), accion("u", 5, [{ dia: dias[3]!, precio: 811.3 }])]);
    const r = calcularProyeccion(e, P({ horizonteMeses: 2 }));
    const va = 37 * a.at(-1)!.precio;
    expect(r.supuestos.fraccionProyectada).toBeCloseTo(va / (va + 5 * 811.3), 12);
  });

  it("si nada tiene historia suficiente, las bandas colapsan y se avisa; si nada se puede valorar, también", () => {
    const corta = calcularProyeccion(entradas([accion("u", 5, [{ dia: dias[3]!, precio: 811.3 }])]), P({ horizonteMeses: 3 }));
    expect(corta.puntos.every((p) => p.p5 === p.p95)).toBe(true);
    expect(corta.supuestos.avisos.map((x) => x.codigo)).toContain("SIN_POSICIONES_PROYECTADAS");
    expect(corta.supuestos.ventana).toBeNull();
    const vacia = calcularProyeccion(entradas([accion("v", 5, [])]), P({ horizonteMeses: 3, aportePeriodico: 41.3 }));
    expect(vacia.valorHoy).toBe(0);
    expect(vacia.supuestos.avisos.map((x) => x.codigo)).toContain("SIN_POSICIONES_VALORADAS");
    expect(vacia.puntos.at(-1)!.p50).toBeCloseTo(3 * 41.3, 9);
    expect(vacia.supuestos.fraccionProyectada).toBe(0);
  });

  it("rendimiento y volatilidad anuales de la ventana como dato histórico", () => {
    const r = calcularProyeccion(entradas([accion("a", 37, a)]), P({ horizonteMeses: 1 }));
    const logs = a.slice(1).map((c, j) => Math.log(c.precio / a[j]!.precio));
    const mediaLog = logs.reduce((s, x) => s + x, 0) / logs.length;
    const anual = 12 * r.supuestos.ruedasPorMes;
    expect(r.supuestos.rendimientoAnualVentana!).toBeCloseTo(Math.exp(mediaLog * anual) - 1, 9);
    expect(r.supuestos.volatilidadAnualVentana!).toBeGreaterThan(0);
  });
});
