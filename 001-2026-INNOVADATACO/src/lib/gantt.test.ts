import { describe, it, expect } from "vitest";
import {
  rangoDeItems,
  fraccion,
  posicionItem,
  fraccionAvance,
  posicionHoy,
  ticks,
  type ItemGantt,
} from "./gantt";

const d = (iso: string) => new Date(iso + "T00:00:00");

const BARRA: ItemGantt = {
  id: "e1",
  tipo: "barra",
  inicio: d("2026-09-01"),
  fin: d("2026-09-30"),
  avance: 50,
  label: "Entregable",
};
const HITO: ItemGantt = { id: "h1", tipo: "hito", inicio: d("2026-09-15"), fin: null, label: "Hito" };

describe("rangoDeItems (spec 015, FR-001)", () => {
  it("va del inicio más temprano al fin más tardío, con margen", () => {
    const rango = rangoDeItems([BARRA, HITO], d("2026-09-10"));

    expect(rango).not.toBeNull();
    // Margen de un día: desde 31-ago, hasta 1-oct.
    expect(rango!.desde).toEqual(d("2026-08-31"));
    expect(rango!.hasta).toEqual(d("2026-10-01"));
  });

  it("incluye 'hoy' en el rango aunque caiga fuera de las tareas", () => {
    const rango = rangoDeItems([BARRA], d("2026-12-25"));

    expect(rango!.hasta.getTime()).toBeGreaterThanOrEqual(d("2026-12-25").getTime());
  });

  it("sin items con fecha devuelve null (estado vacío, SC-002)", () => {
    expect(rangoDeItems([], d("2026-09-01"))).toBeNull();
  });

  it("un cronograma de un solo día no tiene ancho cero (Edge Case)", () => {
    const puntual: ItemGantt = { id: "x", tipo: "hito", inicio: d("2026-09-15"), fin: null, label: "X" };
    const rango = rangoDeItems([puntual], d("2026-09-15"));

    const dias = Math.round((rango!.hasta.getTime() - rango!.desde.getTime()) / 86400000);
    expect(dias).toBeGreaterThanOrEqual(7);
  });
});

describe("fraccion y posicionItem (spec 015, SC-001)", () => {
  const rango = { desde: d("2026-09-01"), hasta: d("2026-09-11") }; // 10 días

  it("el inicio del rango es 0 y el fin es 1", () => {
    expect(fraccion(d("2026-09-01"), rango)).toBe(0);
    expect(fraccion(d("2026-09-11"), rango)).toBe(1);
  });

  it("la mitad del rango es 0.5", () => {
    expect(fraccion(d("2026-09-06"), rango)).toBeCloseTo(0.5);
  });

  it("acota fuera de rango a 0 y 1", () => {
    expect(fraccion(d("2026-08-01"), rango)).toBe(0);
    expect(fraccion(d("2026-12-01"), rango)).toBe(1);
  });

  it("una barra ocupa de su inicio a su fin", () => {
    const pos = posicionItem({ ...BARRA, inicio: d("2026-09-03"), fin: d("2026-09-08") }, rango);

    expect(pos.left).toBeCloseTo(0.2);
    expect(pos.width).toBeCloseTo(0.5);
  });

  it("un rombo (hito puntual) tiene ancho 0", () => {
    expect(posicionItem({ ...HITO, inicio: d("2026-09-06") }, rango).width).toBe(0);
  });
});

describe("fraccionAvance (spec 015, FR-001)", () => {
  it("es el avance/100 de una barra", () => {
    expect(fraccionAvance({ ...BARRA, avance: 75 })).toBe(0.75);
  });

  it("un rombo no tiene relleno de avance", () => {
    expect(fraccionAvance(HITO)).toBe(0);
  });

  it("acota el avance a 0..1", () => {
    expect(fraccionAvance({ ...BARRA, avance: 150 })).toBe(1);
    expect(fraccionAvance({ ...BARRA, avance: -10 })).toBe(0);
  });
});

describe("posicionHoy (spec 015, FR-003)", () => {
  const rango = { desde: d("2026-09-01"), hasta: d("2026-09-11") };

  it("da la fracción de hoy cuando cae dentro del rango", () => {
    expect(posicionHoy(rango, d("2026-09-06"))).toBeCloseTo(0.5);
  });

  it("es null cuando hoy cae fuera del rango dibujado", () => {
    expect(posicionHoy(rango, d("2026-12-25"))).toBeNull();
    expect(posicionHoy(rango, d("2026-01-01"))).toBeNull();
  });
});

describe("ticks (spec 015, FR-002)", () => {
  const rango = { desde: d("2026-09-01"), hasta: d("2026-09-15") };

  it("día: una marca por día", () => {
    const t = ticks(rango, "dia");
    expect(t).toHaveLength(15); // 1 a 15 inclusive
    expect(t[0].etiqueta).toBe("1");
  });

  it("semana: marcas en lunes, con día y mes", () => {
    const t = ticks(rango, "semana");
    // 1-sep-2026 es martes; el lunes de esa semana es 31-ago.
    expect(t.every((tick) => tick.fecha.getDay() === 1)).toBe(true);
    expect(t[0].etiqueta).toMatch(/(ago|sep)/);
  });

  it("mes: una marca por día 1, con mes y año", () => {
    const anual = { desde: d("2026-08-15"), hasta: d("2026-11-15") };
    const t = ticks(anual, "mes");
    expect(t.map((x) => x.etiqueta)).toEqual(["ago 2026", "sep 2026", "oct 2026", "nov 2026"]);
  });

  it("cada marca lleva su fracción de posición", () => {
    const t = ticks(rango, "dia");
    expect(t[0].fraccion).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1].fraccion).toBeLessThanOrEqual(1);
  });
});
