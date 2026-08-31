// SPEC-325 · mecanismo de monitoreo compartido · UN solo lugar de normalización.
//
// La decisión del CEO (002-PI-225) exige que el cruce identificador→alerta sea
// uno solo, con la normalización en un ÚNICO lugar. Esta función es ese lugar.
// Se aplica en TODA ESCRITURA de identificador (contacto vigilado, hijo protegido,
// e ingesta de reporte), de modo que el cruce compare siempre valores ya
// normalizados sin re-normalizar en cada lectura (candado 22 v5).
//
// Defecto que cierra (defecto silencioso): antes el valor se guardaba crudo
// (solo `trim`) mientras el reporte entraba con otro case → `TioJuan1` guardado
// no cruzaba con `tiojuan1` reportado, y no avisaba. Con esta forma canónica
// (trim + lowercase) ambos lados coinciden.

/**
 * Forma canónica de un identificador vigilado/reportado.
 * Regla mínima del núcleo: recorta espacios y pasa a minúsculas.
 * Si en el futuro una plataforma necesita otra regla (p.ej. quitar `@`),
 * se AMPLÍA esta función — nunca se crea una segunda normalización.
 */
export function normalizarIdentificador(valor: string): string {
    return valor.trim().toLowerCase();
}
