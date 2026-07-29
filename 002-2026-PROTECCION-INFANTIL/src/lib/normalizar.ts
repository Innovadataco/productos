/**
 * SPEC-115: normalización de nombres geográficos (ciudades/departamentos/países).
 * ÚNICA fuente de verdad: la usan el importador GeoNames, el endpoint de búsqueda
 * y los tests, de modo que "medellin" case con "Medellín" en todos lados.
 *
 * NFD + eliminación de diacríticos + minúsculas + colapso de caracteres no
 * alfanuméricos a un espacio.
 */
export function normalizarNombreGeografico(nombre: string): string {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
