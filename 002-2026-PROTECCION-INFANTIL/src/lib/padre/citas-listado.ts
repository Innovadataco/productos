/**
 * SPEC-545 · badge del listado «Mis citas» del padre.
 *
 * Regla de Diseño (layout 06-09): el estado de una cita es PROCESO, no criticidad,
 * así que NUNCA se pinta en rubí. Confirmada→cielo, esperando→ámbar, realizada→pino,
 * y los finales sin asistencia/vencida/reembolsada/reprogramada→neutro (tinta).
 *
 * Pura y sin React para que el candado la verifique por conducta.
 *
 * SPEC-749: se retiró `grupoDeCita` —agrupaba por tiempo con frontera propia (≈ FIN) y
 * NO tenía llamador de producción; su candado daba cobertura falsa—. La verdad temporal
 * de una cita la deriva la fuente única `estadoEfectivoDeCita` (#718).
 */
import type { EstadoSolicitudCita } from "@prisma/client";
import { estadoEfectivoDeCita, type EntradaTiempo } from "@/lib/profesional/cita/estado-efectivo";

export type BadgeCita = { label: string; clases: string };

// SPEC-730 · tratamiento de ESTADO FINAL NEUTRO (tinta): los finales sin asistencia/vencida/
// reembolsada/reprogramada, y —desde SPEC-749 FR-2— la CONFIRMADA cuya hora ya pasó. Fuente
// ÚNICA para que la lista reuse el MISMO tratamiento y no derive uno inventado.
const CLASES_ESTADO_NEUTRO = "bg-tinta/10 text-muted";

/**
 * Badge de estado. Color de PROCESO, CERO rubí (una cita no es una alarma de
 * criticidad). cielo=confirmada, ámbar=esperando, pino=realizada, tinta=final neutro.
 */
export function badgeDeCita(estado: EstadoSolicitudCita): BadgeCita {
    const NEUTRO = CLASES_ESTADO_NEUTRO;
    switch (estado) {
        case "CONFIRMADA":
            return { label: "Confirmada", clases: "bg-cielo/10 text-cielo" };
        case "SIN_CONFIRMAR":
        case "PAGADA_PENDIENTE":
            return { label: "Esperando al profesional", clases: "bg-ambar/10 text-estado-ambar" };
        case "CUMPLIDA":
            return { label: "Realizada", clases: "bg-pino/10 text-estado-pino" };
        case "NO_ASISTIO_PADRE":
            return { label: "No asististe", clases: NEUTRO };
        case "NO_ASISTIO_PROFESIONAL":
            return { label: "El profesional no asistió", clases: NEUTRO };
        case "VENCIDA_SIN_RESPUESTA":
            return { label: "Venció sin respuesta", clases: NEUTRO };
        case "REEMBOLSADA":
            return { label: "Reembolsada", clases: NEUTRO };
        case "REPROGRAMADA":
            return { label: "Reprogramada", clases: NEUTRO };
    }
}

/**
 * SPEC-749 FR-2 · Badge EFECTIVO para la lista: una cita `CONFIRMADA` cuya franja YA PASÓ
 * NO sigue en «Confirmada» (cielo/verde, como una cita viva) — pasa a NEUTRO «Ya pasó»
 * (tinta = estado pasado/cerrado, SPEC-730). El verde era parte de la mentira que mide
 * Jelkin (105/135). Reusa la FUENTE como oráculo de frontera (now≥FIN, falla conservador).
 * El resto de estados (incl. PAGADA_PENDIENTE/SIN_CONFIRMAR) delega en `badgeDeCita`: su
 * verdad de lista la gobierna su propio reloj, no la franja (ver FORMA §14 vs interino).
 */
export function badgeDeCitaEfectivo(
    estado: EstadoSolicitudCita,
    franjaInicio: EntradaTiempo,
    franjaFin: EntradaTiempo,
    ahora: EntradaTiempo,
): BadgeCita {
    if (estado === "CONFIRMADA" && estadoEfectivoDeCita("CONFIRMADA", franjaInicio, franjaFin, ahora) === "PASADA") {
        return { label: "Ya pasó", clases: CLASES_ESTADO_NEUTRO };
    }
    return badgeDeCita(estado);
}
