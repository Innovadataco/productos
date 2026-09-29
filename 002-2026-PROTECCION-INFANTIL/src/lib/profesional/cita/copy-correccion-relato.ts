/**
 * SPEC-780 · Copy del LÍMITE de corregir el relato de la cita (FORMA-SPEC780, Diseño, aaf3f54).
 *
 * El nudo de la pieza es el copy, no la acción: dos restricciones que el padre NO adivina y que
 * le cambian el significado a lo que haga. Un mensaje que calla el límite deja al padre creyendo
 * que borró algo que sigue ahí — y esa creencia es peor que no ofrecer la corrección. Voz tú.
 * Se transcribe VERBATIM de la forma (autoridad de Diseño); lo renderiza el canal de «Mis datos»
 * (petición de SPEC-752/772). NUNCA dice «borramos/eliminamos»: es una corrección CON RASTRO.
 *
 * Pendiente (§3 de la forma): la línea de SALIDA para las versiones anteriores. El CEO decidió
 * que se CONSERVAN (son el registro de pedidos distintos, verdaderos sobre el pasado); Diseño
 * redacta la línea exacta con ese motivo. No se inventa acá.
 */
export const COPY_CORRECCION_RELATO = {
    titulo: "Vamos a corregir el relato de esta cita.",
    intro: "Un miembro del equipo aplica tu corrección a esta cita.",
    // Límite 1: se corrige la VIVA; el historial no se reescribe.
    limiteVersiones:
        "Las versiones anteriores no cambian. Si antes reprogramaste esta cita, lo que escribiste en esos momentos queda como el registro de lo que dijiste entonces — la corrección es de ahora en adelante, no borra lo de antes.",
    // Límite 2: hay rastro; no se reemplaza en silencio lo que el profesional ya leyó.
    limiteProfesional:
        "El profesional ya leyó tu relato. Por eso la corrección queda anotada (se sabe que hubo una corrección y cuándo); no reemplaza en silencio lo que él ya leyó.",
} as const;
