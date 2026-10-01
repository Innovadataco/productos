/**
 * SPEC-790 · La ÚNICA traducción entre el eje de la CITA (`ModalidadCita`) y el eje de la AUTORIDAD
 * (`ModalidadReps`). NO es un pasaje: son dos enums con significados propios — el VIRTUAL de la cita se
 * habilita en el REPS como TELEMEDICINA. Vive en UN SOLO lugar para que el gate (T4), la reubicación y
 * cualquier consumidor futuro traduzcan igual.
 *
 * Un valor SIN mapeo falla hacia NEGAR y queda REGISTRADO. El riesgo no es del profesional sino NUESTRO:
 * si mañana `ModalidadCita` gana un valor y nadie actualiza este mapa, un profesional habilitado para esa
 * modalidad caería del directorio EN SILENCIO y nadie se enteraría. Dos defensas:
 *  1. Estructural (compilador): `Record<ModalidadCita, …>` exige cubrir CADA valor del enum — agregar uno
 *     sin mapearlo NO compila.
 *  2. Runtime (entrada no tipada): la entrada es `string` a propósito (un filtro/dato puede no venir
 *     tipado); un valor fuera del mapa devuelve `{ mapea:false }`, que el gate traduce a NEGAR + registrar.
 */
import type { ModalidadReps } from "./reps-elegibilidad";
import { ModalidadCita } from "@prisma/client";

/** El mapa, en un solo lugar. Exhaustivo sobre `ModalidadCita` (el compilador exige cada valor). */
const CITA_A_REPS: Record<ModalidadCita, ModalidadReps> = {
    [ModalidadCita.VIRTUAL]: "TELEMEDICINA",
    [ModalidadCita.PRESENCIAL]: "PRESENCIAL",
};

export type MapeoModalidadReps =
    | { readonly mapea: true; readonly reps: ModalidadReps }
    | { readonly mapea: false; readonly valorSinMapeo: string };

/**
 * Traduce una modalidad de la cita al eje del REPS. Puro. Acepta `string` a propósito: si el valor no está
 * en el mapa devuelve `{ mapea:false, valorSinMapeo }` — el llamador NIEGA y registra, nunca lo ignora.
 */
export function modalidadCitaAReps(modalidadCita: string): MapeoModalidadReps {
    const reps = (CITA_A_REPS as Record<string, ModalidadReps | undefined>)[modalidadCita];
    return reps !== undefined ? { mapea: true, reps } : { mapea: false, valorSinMapeo: modalidadCita };
}

/**
 * Para el gate: traduce al eje REPS o NIEGA. En no-mapeo registra (warn ruidoso) y devuelve `null` —
 * el profesional NO se cuela sin poder verificar su modalidad, y el hueco de mapeo queda visible en logs
 * en vez de tragarse un habilitado en silencio. `null` = el gate lo excluye (fail-closed).
 */
export function modalidadRepsRequerida(modalidadCita: string): ModalidadReps | null {
    const m = modalidadCitaAReps(modalidadCita);
    if (m.mapea) return m.reps;
    console.warn(
        `[REPS] modalidad de cita sin mapeo al eje REPS: ${JSON.stringify(m.valorSinMapeo)} — niega elegibilidad (fail-closed); revisar CITA_A_REPS`,
    );
    return null;
}
