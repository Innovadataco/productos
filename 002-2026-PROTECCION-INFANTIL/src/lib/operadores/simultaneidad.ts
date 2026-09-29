/**
 * SPEC-750 · Solape de ventanas de tiempo — el núcleo puro de la SIMULTANEIDAD de la
 * asignación de citas. Sin dependencias de infra (unit-testable). `asignador-citas.ts`
 * lo usa; la BD resuelve el mismo predicado en la query (`inicio < fin' AND fin > inicio'`).
 */

/** Dos ventanas `[inicio, fin)` se solapan cuando cada una empieza antes de que la otra termine. */
export function ventanasSolapan(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date): boolean {
    return aInicio.getTime() < bFin.getTime() && bInicio.getTime() < aFin.getTime();
}
