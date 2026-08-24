/**
 * SPEC-236 (002-PI-mega-cola): helpers puros de fechas del motor de expediente.
 * Toda la lógica de límites (inactividad, SLA, retención) se evalúa en la zona
 * horaria del negocio, America/Bogota, usando date-fns-tz (FR-012, US2.4).
 */
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addHours, subMonths } from "date-fns";

export const TIMEZONE_MOTOR_EXPEDIENTE = "America/Bogota";

/**
 * Devuelve el instante límite de inactividad: `meses` meses calendario antes
 * de `ahora`, calculado en America/Bogota. Un expediente cuya última actividad
 * sea anterior a este instante califica para auto-cierre.
 */
export function calcularLimiteInactividad(ahora: Date, meses: number): Date {
    const zoned = toZonedTime(ahora, TIMEZONE_MOTOR_EXPEDIENTE);
    const limiteZoned = subMonths(zoned, meses);
    return fromZonedTime(limiteZoned, TIMEZONE_MOTOR_EXPEDIENTE);
}

/** True si la última actividad (`referencia`) es anterior al límite de inactividad. */
export function cumplioInactividad(referencia: Date, meses: number, ahora: Date): boolean {
    return referencia.getTime() < calcularLimiteInactividad(ahora, meses).getTime();
}

/** Horas de SLA del comité según la gravedad vigente (FR-015). */
export function decidirSlaHoras(
    scoreGravedad: "VERDE" | "AMARILLO" | "ROJO",
    slaHorasNormal: number,
    slaHorasRojo: number
): number {
    return scoreGravedad === "ROJO" ? slaHorasRojo : slaHorasNormal;
}

/** Fecha límite del SLA: `horas` después de `desde`. */
export function calcularFechaLimiteSla(desde: Date, horas: number): Date {
    return addHours(desde, horas);
}

/** True si el SLA está vencido en `ahora`. */
export function slaVencido(ahora: Date, desde: Date, horas: number): boolean {
    return ahora.getTime() > calcularFechaLimiteSla(desde, horas).getTime();
}

/**
 * Devuelve el instante límite de retención: `meses` meses calendario antes de
 * `ahora` en America/Bogota. Expedientes CERRADO anteriores a ese instante
 * califican para purga de textos (`[retenido]`).
 */
export function calcularLimiteRetencion(ahora: Date, meses: number): Date {
    return calcularLimiteInactividad(ahora, meses);
}
