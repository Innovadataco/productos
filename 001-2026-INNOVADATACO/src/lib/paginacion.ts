/**
 * Paginación estándar de las listas (constitución §3.3, spec 009, FR-004).
 *
 * Un único lugar donde se leen y acotan `page`/`pageSize`, para que las rutas no
 * repitan la aritmética y no puedan divergir en los topes.
 */

export const TAMANO_PAGINA_POR_DEFECTO = 25;
export const TAMANO_PAGINA_MAXIMO = 100;

export interface Paginacion {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RespuestaPaginada<T> {
  items: T[];
  pagination: Paginacion;
}

/**
 * Lee `page` y `pageSize` de la query y los acota (§3.3).
 *
 * Nada de esto lanza: un `pageSize` disparatado se recorta al máximo y una
 * `page` inválida cae en 1. Una lista es una lectura; no debe fallar con 400
 * porque alguien escriba basura en la URL.
 */
export function leerPaginacion(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const pageBruta = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(pageBruta) ? Math.max(1, Math.floor(pageBruta)) : 1;

  const tamanoBruto = Number(searchParams.get("pageSize") || String(TAMANO_PAGINA_POR_DEFECTO));
  const pageSize = Number.isFinite(tamanoBruto)
    ? Math.min(TAMANO_PAGINA_MAXIMO, Math.max(1, Math.floor(tamanoBruto)))
    : TAMANO_PAGINA_POR_DEFECTO;

  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Arma la respuesta con la forma que fija §3.3. */
export function respuestaPaginada<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): RespuestaPaginada<T> {
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
