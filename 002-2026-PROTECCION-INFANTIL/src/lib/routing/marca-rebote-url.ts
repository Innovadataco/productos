/**
 * SPEC-572 (loop-cap · residual señalado por Datos) — quitar SOLO la marca `_rv` de una URL,
 * preservando el resto de la query.
 *
 * `/api/sesion/al-dia` re-sella y devuelve al destino con `?_rv=1`. Con estado válido la marca ya
 * cumplió (esta página cargó, no fue rebotada) y no debe quedar pegada en la barra: un favorito o
 * un link compartido con la marca podría, más tarde y en un hueco de estado, disparar el logout de
 * corte del loop-cap sin que haya atacante — el producto disparándose a sí mismo. La página la
 * limpia con `history.replaceState` (ver `LimpiarMarcaRebote`).
 *
 * Función pura para poder afirmar la condición de Datos sin DOM: se borra ÚNICAMENTE `marca`,
 * `?foo=1&_rv=1` → `?foo=1`, nunca se vacía la query a ciegas. Devuelve `null` si no había marca
 * (nada que reemplazar). Preserva pathname, el orden del resto de la query y el hash.
 */
export function urlSinMarcaRebote(href: string, marca: string): string | null {
    const url = new URL(href);
    if (!url.searchParams.has(marca)) return null;
    url.searchParams.delete(marca);
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
