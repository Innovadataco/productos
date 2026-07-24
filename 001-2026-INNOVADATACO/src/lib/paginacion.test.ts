import { describe, it, expect } from "vitest";
import {
  leerPaginacion,
  respuestaPaginada,
  TAMANO_PAGINA_MAXIMO,
  TAMANO_PAGINA_POR_DEFECTO,
} from "./paginacion";

const query = (qs: string) => new URLSearchParams(qs);

describe("leerPaginacion (spec 009, FR-004 / §3.3)", () => {
  it("sin parámetros devuelve la primera página con el tamaño por defecto", () => {
    expect(leerPaginacion(query(""))).toEqual({
      page: 1,
      pageSize: TAMANO_PAGINA_POR_DEFECTO,
      skip: 0,
    });
  });

  it("calcula el salto a partir de página y tamaño", () => {
    expect(leerPaginacion(query("page=3&pageSize=10"))).toEqual({
      page: 3,
      pageSize: 10,
      skip: 20,
    });
  });

  it("acota un pageSize disparatado al máximo, sin devolver error", () => {
    expect(leerPaginacion(query("pageSize=100000")).pageSize).toBe(TAMANO_PAGINA_MAXIMO);
  });

  it("una página o tamaño inválidos caen en valores sanos: leer una lista no debe fallar", () => {
    expect(leerPaginacion(query("page=0")).page).toBe(1);
    expect(leerPaginacion(query("page=-5")).page).toBe(1);
    expect(leerPaginacion(query("page=abc")).page).toBe(1);
    expect(leerPaginacion(query("pageSize=0")).pageSize).toBe(1);
    expect(leerPaginacion(query("pageSize=abc")).pageSize).toBe(TAMANO_PAGINA_POR_DEFECTO);
  });

  it("trunca los decimales en vez de propagarlos al skip", () => {
    expect(leerPaginacion(query("page=2.7&pageSize=10.9"))).toEqual({
      page: 2,
      pageSize: 10,
      skip: 10,
    });
  });
});

describe("respuestaPaginada (spec 009, §3.3)", () => {
  it("devuelve items y metadatos con el total de páginas redondeado hacia arriba", () => {
    expect(respuestaPaginada([{ id: "a" }], 26, 1, 25)).toEqual({
      items: [{ id: "a" }],
      pagination: { page: 1, pageSize: 25, total: 26, totalPages: 2 },
    });
  });

  it("con cero resultados devuelve cero páginas y lista vacía", () => {
    expect(respuestaPaginada([], 0, 1, 25).pagination).toEqual({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
    });
  });
});
