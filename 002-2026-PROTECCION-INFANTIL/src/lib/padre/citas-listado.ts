/**
 * SPEC-545 · agrupación y badge del listado «Mis citas» del padre.
 *
 * Regla de Diseño (layout 06-09): el estado de una cita es PROCESO, no criticidad,
 * así que NUNCA se pinta en rubí. Confirmada→cielo, esperando→ámbar, realizada→pino,
 * y los finales sin asistencia/vencida/reembolsada/reprogramada→neutro (tinta).
 *
 * Pura y sin React para que el candado la verifique por conducta.
 */
import type { EstadoSolicitudCita } from "@prisma/client";

export type GrupoCita = "proximas" | "pasadas" | "canceladas";

/** A qué grupo del listado va la cita. `esFutura` = la franja aún no pasó. */
export function grupoDeCita(estado: EstadoSolicitudCita, esFutura: boolean): GrupoCita {
    switch (estado) {
        case "SIN_CONFIRMAR":
        case "PAGADA_PENDIENTE":
            return "proximas";
        case "CONFIRMADA":
            return esFutura ? "proximas" : "pasadas";
        case "CUMPLIDA":
            return "pasadas";
        case "NO_ASISTIO_PADRE":
        case "NO_ASISTIO_PROFESIONAL":
        case "VENCIDA_SIN_RESPUESTA":
        case "REEMBOLSADA":
        case "REPROGRAMADA":
            return "canceladas";
    }
}

export type BadgeCita = { label: string; clases: string };

/**
 * Badge de estado. Color de PROCESO, CERO rubí (una cita no es una alarma de
 * criticidad). cielo=confirmada, ámbar=esperando, pino=realizada, tinta=final neutro.
 */
export function badgeDeCita(estado: EstadoSolicitudCita): BadgeCita {
    const NEUTRO = "bg-tinta/10 text-muted";
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
