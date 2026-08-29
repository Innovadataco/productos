import { describe, it, expect } from "vitest";
import { entregablesAItems, hitosAItems, entregablesSinFecha } from "./ganttAdaptador";

describe("entregablesAItems (spec 015, FR-006)", () => {
  it("una barra por entregable con fecha de compromiso, de su inicio al compromiso", () => {
    const items = entregablesAItems([
      {
        id: "e1",
        nombre: "Informe",
        avance: 50,
        fechaInicio: "2026-09-01",
        fechaCompromiso: "2026-09-30",
        createdAt: "2026-08-01",
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "entregable:e1", tipo: "barra", avance: 50, label: "Informe" });
    expect(items[0].inicio).toEqual(new Date("2026-09-01"));
    expect(items[0].fin).toEqual(new Date("2026-09-30"));
  });

  it("sin fechaInicio usa createdAt para no dejarlo fuera del Gantt", () => {
    const items = entregablesAItems([
      { id: "e2", nombre: "X", avance: 0, fechaInicio: null, fechaCompromiso: "2026-10-15", createdAt: "2026-09-20" },
    ]);

    expect(items[0].inicio).toEqual(new Date("2026-09-20"));
  });

  it("un entregable SIN fecha de compromiso se excluye: no se puede situar", () => {
    const items = entregablesAItems([
      { id: "e3", nombre: "Sin fecha", avance: 0, fechaInicio: null, fechaCompromiso: null, createdAt: "2026-09-01" },
    ]);

    expect(items).toEqual([]);
  });

  it("propaga la dependencia (spec 016)", () => {
    const items = entregablesAItems([
      { id: "e4", nombre: "B", avance: 0, fechaInicio: "2026-09-01", fechaCompromiso: "2026-09-10", createdAt: "", dependeDe: "hito:h1" },
    ]);
    expect(items[0].dependeDe).toBe("hito:h1");
  });
});

describe("hitosAItems (spec 015, FR-001)", () => {
  it("un rombo puntual cuando no hay fechaFin", () => {
    const items = hitosAItems([{ id: "h1", nombre: "Kickoff", fecha: "2026-09-01", fechaFin: null }]);

    expect(items[0]).toMatchObject({ id: "hito:h1", tipo: "hito", label: "Kickoff" });
    expect(items[0].fin).toBeNull();
  });

  it("un rango cuando hay fechaFin", () => {
    const items = hitosAItems([{ id: "h2", nombre: "Fase", fecha: "2026-09-01", fechaFin: "2026-12-31" }]);

    expect(items[0].fin).toEqual(new Date("2026-12-31"));
  });
});

describe("entregablesSinFecha (spec 015)", () => {
  it("cuenta los que no entran al Gantt por no tener compromiso", () => {
    expect(
      entregablesSinFecha([
        { id: "a", nombre: "", avance: 0, fechaInicio: null, fechaCompromiso: "2026-09-30", createdAt: "" },
        { id: "b", nombre: "", avance: 0, fechaInicio: null, fechaCompromiso: null, createdAt: "" },
      ]),
    ).toBe(1);
  });
});
