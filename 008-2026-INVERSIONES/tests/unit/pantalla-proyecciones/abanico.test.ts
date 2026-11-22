// El abanico de la pantalla (frente proyecciones-pantalla): un eje de días con la historia mensual, «Hoy» y un día
// por mes proyectado; las series de la historia y de la proyección no se unen; y el «plano» de tamaño fijo con que
// se interpola un resultado contra el siguiente aunque cambie el horizonte (más allá del horizonte se repite el último
// mes, así el abanico crece o se recoge sin saltar). Inventado.
import { describe, expect, it } from "vitest";
import { MESES_PLANO, aPlano, armarAbanico, dePlano, sumarMeses } from "@/app/proyecciones/abanico";
import { aVistaProyeccion } from "@/app/proyecciones/vista";
import { PARAMETROS, resultadoFicticio } from "./ficticio";

describe("sumarMeses", () => {
  it.each([
    ["2027-03-17", 0, "2027-03-17"],
    ["2027-03-17", 1, "2027-04-17"],
    ["2027-03-17", 10, "2028-01-17"],
    ["2027-01-31", 1, "2027-02-28"],
    ["2028-01-31", 1, "2028-02-29"],
    ["2027-10-31", 1, "2027-11-30"],
    ["2027-03-17", 120, "2037-03-17"],
  ])("%s + %i meses = %s (al final del mes si el día no existe)", (dia, meses, esperado) => {
    expect(sumarMeses(dia, meses)).toBe(esperado);
  });
});

describe("armarAbanico", () => {
  const vista = aVistaProyeccion(resultadoFicticio());
  const historia = [{ dia: "2027-01-29", valor: 44_701.13 }, { dia: "2027-02-26", valor: 45_793.29 }];

  it("los días: la historia, hoy y un día por mes; el corte «Hoy» en el día de hoy", () => {
    const a = armarAbanico(historia, vista);
    expect(a.dias.slice(0, 4)).toEqual(["2027-01-29", "2027-02-26", "2027-03-17", "2027-04-17"]);
    expect(a.dias).toHaveLength(2 + 13);
    expect(a.dias.at(-1)).toBe("2028-03-17");
    expect(a.indiceHoy).toBe(2);
    expect(a.mes).toEqual([null, null, ...Array.from({ length: 13 }, (_, m) => m)]);
  });

  it("la historia solo antes de hoy; la proyección desde hoy; nunca una línea que las una", () => {
    const a = armarAbanico(historia, vista);
    expect(a.real).toEqual([44_701.13, 45_793.29, ...Array<null>(13).fill(null)]);
    expect(a.p50.slice(0, 2)).toEqual([null, null]);
    expect(a.p50[2]).toBe(vista.puntos[0]!.p50);
    expect(a.p95.at(-1)).toBe(vista.puntos[12]!.p95);
    expect(a.aportado.at(-1)).toBe(vista.puntos[12]!.aportado);
  });

  it("un dato de la historia del mismo día de hoy (o posterior) no se repite en el eje", () => {
    const a = armarAbanico([...historia, { dia: "2027-03-17", valor: 46_011.73 }], vista);
    expect(a.dias.filter((d) => d === "2027-03-17")).toHaveLength(1);
    expect(a.real[a.indiceHoy]).toBe(46_011.73);
    expect(armarAbanico([{ dia: "2027-04-01", valor: 1.37 }], vista).dias[0]).toBe("2027-03-17");
  });

  it("sin historia, el eje empieza en hoy", () => {
    const a = armarAbanico([], vista);
    expect(a.indiceHoy).toBe(0);
    expect(a.real.every((v) => v === null)).toBe(true);
  });
});

describe("plano para interpolar", () => {
  it("6 curvas × 121 meses; más allá del horizonte se repite el último mes", () => {
    const v = aVistaProyeccion(resultadoFicticio());
    const plano = aPlano(v.puntos);
    expect(MESES_PLANO).toBe(121);
    expect(plano).toHaveLength(6 * MESES_PLANO);
    const curvas = dePlano(plano, 120);
    expect(curvas.p50).toHaveLength(121);
    expect(curvas.p50[12]).toBe(v.puntos[12]!.p50);
    expect(curvas.p50[120]).toBe(v.puntos[12]!.p50);
    expect(curvas.p5[57]).toBe(v.puntos[12]!.p5);
  });

  it("dePlano devuelve las curvas del horizonte pedido (ida y vuelta exacta)", () => {
    const v = aVistaProyeccion(resultadoFicticio({ parametros: { ...PARAMETROS, horizonteMeses: 37 } }));
    const c = dePlano(aPlano(v.puntos), 37);
    expect(c.p5).toEqual(v.puntos.map((p) => p.p5));
    expect(c.p25).toEqual(v.puntos.map((p) => p.p25));
    expect(c.p50).toEqual(v.puntos.map((p) => p.p50));
    expect(c.p75).toEqual(v.puntos.map((p) => p.p75));
    expect(c.p95).toEqual(v.puntos.map((p) => p.p95));
    expect(c.aportado).toEqual(v.puntos.map((p) => p.aportado));
  });

  it("sin puntos, el plano es de ceros (no NaN)", () => {
    expect(aPlano([]).every((x) => x === 0)).toBe(true);
  });
});
