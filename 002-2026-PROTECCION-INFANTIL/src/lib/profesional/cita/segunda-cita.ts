/**
 * SPEC-940 (I-452) · PI intermedia SOLO la primera cita con cada profesional, y ES esa primera cita CONSUMIDA la
 * que, a su vez, le reabre al padre el contacto de ESE profesional (para coordinar las siguientes directo).
 *
 * Brief A-75 v2.0 §4/§9: de la 2.ª cita en adelante PI no cobra ni intermedia. Jelkin (VEREDICTO 19-11): tras la
 * 1.ª cita CONSUMIDA el padre coordina DIRECTO → se le revela el contacto del profesional (unidireccional).
 *
 * Módulo PURO (sin BD): la UI, el servicio de citas, el repo y la fuente de contacto comparten el MISMO set, para
 * que valga la invariante **contacto visible ⟺ 2.ª cita bloqueada por PI** (mismo conjunto de estados).
 */
import type { EstadoSolicitudCita } from "@prisma/client";

/**
 * Estados en los que el padre CONSUMIÓ su 1.ª cita intermediada con el profesional. VEREDICTO CEO (set chico):
 *  · `CONFIRMADA` / `CUMPLIDA` — la cita ocurrió o está por ocurrir con ese profesional.
 *  · `NO_ASISTIO_PADRE` — el profesional estaba; el padre faltó → igual consumió su cupo.
 * NO entran `NO_ASISTIO_PROFESIONAL` (falló el profesional → el padre REASIGNA a otro sin pagar, D-103(h): se va
 * de ese profesional, no se le revela ni se le bloquea) ni `REUBICADA` (la cita se movió a otro profesional, art.
 * 19 / SPEC-814: el contacto del nuevo lo gobierna la cita nueva por su propio estado, no este terminal).
 */
export const ESTADOS_PRIMERA_CITA_CONSUMIDA: EstadoSolicitudCita[] = ["CONFIRMADA", "CUMPLIDA", "NO_ASISTIO_PADRE"];

export function primeraCitaConsumida(estado: EstadoSolicitudCita): boolean {
    return ESTADOS_PRIMERA_CITA_CONSUMIDA.includes(estado);
}

/** Mensaje al padre (voz tú). COPY PROVISIONAL: lo define Diseño (FORMA nueva de SPEC-940, pedida por el CEO). */
export const MENSAJE_SEGUNDA_CITA_FUERA_DE_PI =
    "Ya tuviste una cita con este profesional por la red. Las siguientes las acuerdas directamente con él o ella (su contacto está en los datos de tu cita); desde aquí puedes pedir una primera cita con otro profesional.";
