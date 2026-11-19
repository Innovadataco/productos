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
import type { EstadoSolicitudCita, PerfilProfesional } from "@prisma/client";

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

/**
 * SPEC-940 · estados de PERFIL que CIERRAN el contacto por encima del estado de la cita (reserva legal H-2 ·
 * Ley 2375/2024): un profesional VENCIDO/SUSPENDIDO no expone su contacto AUNQUE la cita esté consumida. Fuente
 * ÚNICA para que el override del contacto y el bloqueo de la 2.ª cita usen la MISMA condición (invariante
 * «visible ⟺ bloqueado», borde vencido incluido).
 */
export const ESTADOS_PERFIL_CONTACTO_CERRADO: PerfilProfesional["estado"][] = ["VENCIDO", "SUSPENDIDO"];

/**
 * El predicado COMPLETO de «contacto exponible al padre» = 1.ª cita consumida Y perfil no cerrado. Es EXACTAMENTE
 * lo que decide `debeExponerContacto(..., "padre_ve_profesional")` y lo que bloquea la 2.ª cita por PI.
 */
export function contactoExponibleAlPadre(estadoCita: EstadoSolicitudCita, estadoPerfil: PerfilProfesional["estado"] | null): boolean {
    if (estadoPerfil !== null && ESTADOS_PERFIL_CONTACTO_CERRADO.includes(estadoPerfil)) return false;
    return primeraCitaConsumida(estadoCita);
}

/**
 * Aviso al padre (voz tú) cuando pide por PI otra cita con un profesional cuya 1.ª ya consumió. Copy de Diseño
 * (FORMA SPEC-938 v2.0, Gestión `169bd6fc`, §(a)). Apunta al canal REAL: por la invariante visible⟺bloqueado, cuando
 * este mensaje aparece el contacto del profesional está garantizado visible en el panel de la cita.
 */
export function mensajeSegundaCitaFueraDePi(nombreProfesional: string): string {
    return (
        `Con ${nombreProfesional} ya tuviste tu primera cita. De la segunda en adelante la coordinas directamente con ` +
        "el profesional — tienes sus datos en el panel de tu cita (correo y teléfono). Protección Infantil acompaña y " +
        "cobra solo la primera cita con cada profesional, por eso esta no se crea por acá."
    );
}

/** Fragmento INVARIANTE del aviso (no depende del nombre) — para candados sobre frase interpolada. */
export const FRAGMENTO_SEGUNDA_CITA_CANAL = "tienes sus datos en el panel de tu cita";
