import { describe, it, expect } from "vitest";
import {
  agruparPorColumna,
  tarjetasHuerfanas,
  esMovimientoReal,
  type ColumnaKanban,
  type TarjetaKanban,
} from "./kanban";

const COLUMNAS: ColumnaKanban[] = [
  { id: "1", titulo: "Abierta" },
  { id: "2", titulo: "En proceso" },
  { id: "3", titulo: "Cerrada" },
];

const TARJETAS: TarjetaKanban[] = [
  { id: "a", columnaId: "1", titulo: "Primera" },
  { id: "b", columnaId: "3", titulo: "Segunda" },
  { id: "c", columnaId: "1", titulo: "Tercera" },
];

describe("agruparPorColumna (spec 007, FR-003)", () => {
  it("respeta el orden del catálogo, no un orden cableado (US1-4)", () => {
    const grupos = agruparPorColumna(COLUMNAS, TARJETAS);

    expect(grupos.map((g) => g.columna.titulo)).toEqual(["Abierta", "En proceso", "Cerrada"]);
  });

  it("coloca cada tarjeta en la columna de su columnaId (US1-1)", () => {
    const grupos = agruparPorColumna(COLUMNAS, TARJETAS);

    expect(grupos[0].tarjetas.map((t) => t.id)).toEqual(["a", "c"]);
    expect(grupos[2].tarjetas.map((t) => t.id)).toEqual(["b"]);
  });

  it("devuelve la columna vacía en vez de omitirla (US1-3)", () => {
    const grupos = agruparPorColumna(COLUMNAS, TARJETAS);

    expect(grupos).toHaveLength(3);
    expect(grupos[1].tarjetas).toEqual([]);
  });

  it("no ubica en ninguna columna una tarjeta con columna inexistente (US1-2)", () => {
    const conHuerfana = [...TARJETAS, { id: "x", columnaId: "99", titulo: "Rota" }];

    const grupos = agruparPorColumna(COLUMNAS, conHuerfana);

    expect(grupos.flatMap((g) => g.tarjetas.map((t) => t.id))).not.toContain("x");
  });

  it("con catálogo vacío devuelve cero columnas y no lanza (Edge Case)", () => {
    expect(agruparPorColumna([], TARJETAS)).toEqual([]);
  });
});

describe("tarjetasHuerfanas (spec 007, US1-2)", () => {
  it("detecta la tarjeta cuya columna no existe", () => {
    const conHuerfana = [...TARJETAS, { id: "x", columnaId: "99", titulo: "Rota" }];

    expect(tarjetasHuerfanas(COLUMNAS, conHuerfana).map((t) => t.id)).toEqual(["x"]);
  });

  it("devuelve vacío cuando todo dato es consistente", () => {
    expect(tarjetasHuerfanas(COLUMNAS, TARJETAS)).toEqual([]);
  });
});

describe("esMovimientoReal (spec 007, FR-009)", () => {
  it("es true al soltar en una columna distinta", () => {
    expect(esMovimientoReal(TARJETAS, "a", "2")).toBe(true);
  });

  it("es false al soltar en la MISMA columna: sin llamada ni auditoría (US2-5)", () => {
    expect(esMovimientoReal(TARJETAS, "a", "1")).toBe(false);
  });

  it("es false si la tarjeta no existe", () => {
    expect(esMovimientoReal(TARJETAS, "inexistente", "2")).toBe(false);
  });
});
