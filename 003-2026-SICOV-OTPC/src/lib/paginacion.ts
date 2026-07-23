/// Paginación server-side estándar (constitución §4.3): DEFAULT 25, MAX 100.
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface Pagina {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/// Normaliza page/pageSize desde query params (o números crudos) a valores acotados.
export function resolverPagina(page?: unknown, pageSize?: unknown): Pagina {
  const p = Math.max(1, Number.parseInt(String(page ?? ""), 10) || 1);
  const rawSize = Number.parseInt(String(pageSize ?? ""), 10) || DEFAULT_PAGE_SIZE;
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}

export interface Paginado<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function construirPaginado<T>(items: T[], total: number, pagina: Pagina): Paginado<T> {
  return {
    items,
    pagination: {
      page: pagina.page,
      pageSize: pagina.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagina.pageSize)),
    },
  };
}
