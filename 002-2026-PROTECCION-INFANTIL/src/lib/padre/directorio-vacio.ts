/**
 * SPEC-656 (I-387) · Clasifica el VACÍO del directorio del padre.
 *
 * El defecto: con CERO profesionales verificados en total, la pantalla decía
 * «Ningún profesional coincide con los filtros» — le afirmaba al padre dos cosas
 * falsas (que hay filtros que ajustar, y que el problema es su búsqueda) cuando el
 * problema es nuestro: todavía no hay inventario. Y el padre llega ahí justo
 * después de reportar algo sobre su hijo — el peor momento para un callejón que lo
 * culpa.
 *
 * La distinción es **detectable, no interpretable** (radicado): sale de un conteo,
 * no de adivinar. `hayVerificados` lo calcula el API contando la consulta base SIN
 * filtros, con el MISMO predicado que la lista (estado ACTIVO ∧ vigencia vigente).
 *
 * - `estructural`: 0 verificados EN TOTAL. Asumirlo en primera persona; **nunca**
 *   culpar la búsqueda. Lleva una salida honesta (canales oficiales + volver al
 *   expediente).
 * - `por-filtro`: hay verificados, ninguno con esos filtros → ahí **sí** «amplía tu búsqueda».
 * - `con-resultados`: hay para mostrar.
 *
 * Esto decide CUÁL vacío es; el copy de cada caso lo fija Diseño.
 */
export type EstadoVacioDirectorio = "con-resultados" | "estructural" | "por-filtro";

export function clasificarVacioDirectorio(
    cantidadListada: number,
    hayVerificados: boolean,
): EstadoVacioDirectorio {
    // La lista en mano manda: nunca pintar un vacío teniendo resultados.
    if (cantidadListada > 0) return "con-resultados";
    // Sin inventario, el vacío es ESTRUCTURAL — jamás «por filtro» (jamás culpar la búsqueda).
    return hayVerificados ? "por-filtro" : "estructural";
}
