import { describe, it, expect } from "vitest";
import { construirFiltros } from "./filtros";

describe("construirFiltros (spec 003, FR-014, FR-022)", () => {
  it("siempre excluye los documentos inactivos (SC-015)", () => {
    const sql = construirFiltros({});
    // El primer fragmento fija activo = true; sin valores parametrizados aún.
    expect(sql.strings.join("")).toContain('"activo" = true');
  });

  it("los valores de filtro viajan parametrizados, no concatenados (FR-012)", () => {
    const sql = construirFiltros({ tipo: "decreto", entidad: "MinTransporte" });
    expect(sql.values).toContain("decreto");
    expect(sql.values).toContain("MinTransporte");
    // El literal del valor no aparece en el texto SQL: va como parámetro.
    expect(sql.strings.join("")).not.toContain("decreto");
  });

  it("convierte las fechas a Date parametrizadas", () => {
    const sql = construirFiltros({ fechaDesde: "2020-01-01", fechaHasta: "2021-12-31" });
    const fechas = sql.values.filter((v) => v instanceof Date);
    expect(fechas).toHaveLength(2);
  });

  it("sin filtros solo aplica el de actividad", () => {
    const sql = construirFiltros({});
    expect(sql.values).toHaveLength(0);
  });
});
