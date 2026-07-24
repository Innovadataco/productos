import { describe, it, expect } from "vitest";
import {
  calcularAgregados,
  avancePromedio,
  presupuestoTotal,
  contarRiesgosAbiertos,
} from "./cartera";

describe("avancePromedio (spec 014, FR-002 / SC-002)", () => {
  it("es la media del avance de los entregables", () => {
    expect(avancePromedio([{ avance: 100 }, { avance: 50 }, { avance: 0 }])).toBe(50);
  });

  it("redondea a entero", () => {
    expect(avancePromedio([{ avance: 100 }, { avance: 33 }])).toBe(67);
  });

  it("sin entregables es null, no 0: 'no hay nada que medir' no es 'al 0%'", () => {
    expect(avancePromedio([])).toBeNull();
  });
});

describe("presupuestoTotal (spec 014)", () => {
  it("suma lo planeado", () => {
    expect(presupuestoTotal([{ montoPlaneado: 1000 }, { montoPlaneado: 500 }])).toBe(1500);
  });

  it("acepta los Decimal de Prisma, que llegan como string", () => {
    expect(presupuestoTotal([{ montoPlaneado: "1000.50" }, { montoPlaneado: "0.50" }])).toBe(1001);
  });

  it("sin partidas es 0, no NaN", () => {
    expect(presupuestoTotal([])).toBe(0);
  });
});

describe("contarRiesgosAbiertos (spec 014, FR-005)", () => {
  it("cuenta abierto y mitigado; no cuenta cerrado", () => {
    expect(
      contarRiesgosAbiertos([
        { estado: "abierto" },
        { estado: "mitigado" },
        { estado: "cerrado" },
        { estado: "abierto" },
      ]),
    ).toBe(3);
  });

  it("sin riesgos es 0", () => {
    expect(contarRiesgosAbiertos([])).toBe(0);
  });
});

describe("calcularAgregados (spec 014, FR-002 / SC-002)", () => {
  const proyecto = {
    id: "p1",
    codigo: "PRY-001",
    nombre: "Piloto",
    cliente: "IDC",
    currentPhase: "execution",
    entregables: [{ avance: 80 }, { avance: 20 }],
    partidas: [{ montoPlaneado: 5000 }, { montoPlaneado: 2500 }],
    riesgos: [{ estado: "abierto" }, { estado: "cerrado" }],
  };

  it("compone la fila completa de un proyecto", () => {
    expect(calcularAgregados(proyecto)).toEqual({
      id: "p1",
      codigo: "PRY-001",
      nombre: "Piloto",
      cliente: "IDC",
      fase: "execution",
      faseNombre: "Ejecución",
      presupuestoTotal: 7500,
      avancePromedio: 50,
      riesgosAbiertos: 1,
    });
  });

  it("un proyecto vacío no rompe: avance null, presupuesto 0, 0 riesgos (SC-002)", () => {
    const vacio = {
      id: "p2",
      codigo: "PRY-002",
      nombre: "Nuevo",
      cliente: "",
      currentPhase: "initiation",
      entregables: [],
      partidas: [],
      riesgos: [],
    };

    expect(calcularAgregados(vacio)).toMatchObject({
      presupuestoTotal: 0,
      avancePromedio: null,
      riesgosAbiertos: 0,
      faseNombre: "Inicio",
    });
  });
});
