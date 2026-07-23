import { describe, it, expect } from "vitest";
import { resolverPagina, construirPaginado, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./paginacion";

describe("paginación estándar (P1 — §4.3: DEFAULT 25 / MAX 100)", () => {
  it("valores por defecto cuando no hay params", () => {
    const p = resolverPagina(undefined, undefined);
    expect(p).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, take: DEFAULT_PAGE_SIZE });
  });

  it("acota pageSize al máximo (100)", () => {
    expect(resolverPagina("1", "500").pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("calcula skip = (page-1)*pageSize", () => {
    expect(resolverPagina("3", "10")).toMatchObject({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });

  it("page inválida → 1; pageSize 0/vacío → default; negativo se acota a 1", () => {
    expect(resolverPagina("abc", "0")).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(resolverPagina("abc", "-5").pageSize).toBe(1);
  });

  it("construye la envoltura con totalPages", () => {
    const r = construirPaginado([1, 2], 42, resolverPagina("1", "10"));
    expect(r.pagination).toMatchObject({ page: 1, pageSize: 10, total: 42, totalPages: 5 });
    expect(r.items).toEqual([1, 2]);
  });
});
