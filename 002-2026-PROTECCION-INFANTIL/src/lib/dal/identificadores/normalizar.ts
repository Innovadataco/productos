// SPEC-325 · mecanismo de monitoreo compartido · normalización canónica del NÚCLEO.
//
// La decisión del CEO (002-PI-225) exige que el cruce identificador→alerta compare
// siempre la MISMA forma canónica. Esta función es la del núcleo: se aplica en TODA
// ESCRITURA de identificador del núcleo (contacto vigilado, hijo protegido, e ingesta
// de reporte), de modo que el cruce compare valores ya normalizados sin re-normalizar
// en cada lectura (candado 22 v5).
//
// SPEC-674: NO es la única función de normalización. `src/lib/colegio/normalizacion.ts`
// es una SEGUNDA (toma un `tipo`, hoy inerte) que usan las superficies del colegio.
// Hoy dan el MISMO resultado; el match del colegio depende de que sigan coincidiendo.
// `normalizacion-atada-al-nucleo.candado.test.ts` las ATA por conducta: si divergen,
// el match del colegio se rompería en silencio y CI lo para. Las dos están atadas por
// ese candado — no se asume una sola.
//
// Defecto que cierra (defecto silencioso): antes el valor se guardaba crudo
// (solo `trim`) mientras el reporte entraba con otro case → `TioJuan1` guardado
// no cruzaba con `tiojuan1` reportado, y no avisaba. Con esta forma canónica
// (trim + lowercase) ambos lados coinciden.

/**
 * Forma canónica de un identificador vigilado/reportado.
 * Regla mínima del núcleo: recorta espacios y pasa a minúsculas.
 * Si en el futuro una plataforma necesita otra regla (p.ej. quitar `@`),
 * se AMPLÍA esta función Y la de colegio a la vez, o el candado de SPEC-674
 * (que las ata por conducta) se pone rojo: divergir rompe el match del colegio
 * en silencio.
 */
export function normalizarIdentificador(valor: string): string {
    return valor.trim().toLowerCase();
}
