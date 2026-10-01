/**
 * SPEC-780 · Copy del LÍMITE de corregir el relato de la cita (FORMA-SPEC780, Diseño, aaf3f54).
 *
 * El nudo de la pieza es el copy, no la acción: dos restricciones que el padre NO adivina y que
 * le cambian el significado a lo que haga. Un mensaje que calla el límite deja al padre creyendo
 * que borró algo que sigue ahí — y esa creencia es peor que no ofrecer la corrección. Voz tú.
 * Se transcribe VERBATIM de la forma (autoridad de Diseño); lo renderiza el canal de «Mis datos»
 * (petición de SPEC-752/772). NUNCA dice «borramos/eliminamos»: es una corrección CON RASTRO.
 *
 * SPEC-827 (cableo): se CABLEA en el selector de habeas data (eje C, al elegir «Lo que le conté al
 * profesional en una cita» en una RECTIFICACION). `limiteVersiones` trae el REFRESH v1.2 de la forma
 * (FORMA-SPEC780, commit e4b31da): habla por EFECTO —«se reprogramó o pasó a otro profesional»— con
 * «por ejemplo», no enumera el disparador (así no se queda corto cuando el mecanismo crece: reprogramar +
 * reasignar + reubicar). La línea §3 («fundamento», «no es que no podamos…») NO se cablea: está marcada
 * [ABOGADO · tensión, no cierre] — un control legal sin cerrar no va a la cara del padre hasta que el
 * abogado la firme (decisión del CEO, SPEC-827). §2 es el mínimo que el padre necesita para ejercer el derecho.
 */
export const COPY_CORRECCION_RELATO = {
    titulo: "Vamos a corregir el relato de esta cita.",
    intro: "Un miembro del equipo aplica tu corrección a esta cita.",
    // Límite 1: se corrige la VIVA; el historial no se reescribe. REFRESH v1.2 (e4b31da): por EFECTO, no enumera.
    limiteVersiones:
        "Las versiones anteriores no cambian. Si esta cita tuvo versiones anteriores —por ejemplo, porque se reprogramó o pasó a otro profesional—, lo que escribiste en cada momento queda como el registro de lo que dijiste entonces: la corrección es de ahora en adelante, no borra lo de antes.",
    // Límite 2: hay rastro; no se reemplaza en silencio lo que el profesional ya leyó.
    limiteProfesional:
        "El profesional ya leyó tu relato. Por eso la corrección queda anotada (se sabe que hubo una corrección y cuándo); no reemplaza en silencio lo que él ya leyó.",
} as const;
