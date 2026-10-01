/**
 * SPEC-217 (002-PI-117): cálculos puros del freemium del módulo de pagos.
 * Sin dependencias de Prisma en runtime ni E/S; fácilmente testeable (tests
 * unitarios). Toda la aritmética de fechas es en día calendario
 * America/Bogota (FR-003).
 */
import type { DuracionPlan } from "@prisma/client";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addDays, addMonths, endOfDay, startOfDay } from "date-fns";
import { calcularDiasRestantesBogota } from "./renovacion-calculos";

const ZONA_BOGOTA = "America/Bogota";

/** Meses que cubre cada duración de plan. */
export const MESES_POR_DURACION: Record<DuracionPlan, number> = {
    MES_1: 1,
    MES_2: 2,
    MES_3: 3,
    MES_6: 6,
    MES_12: 12,
};

/** Meses cubiertos por una duración; 0 ante un valor desconocido (defensivo). */
export function mesesDeDuracion(duracion: DuracionPlan): number {
    return MESES_POR_DURACION[duracion] ?? 0;
}

/**
 * FR-003: `freemiumFechaFin = fechaInicio + duracion_dias` en día calendario
 * Bogotá, al final del día de corte (23:59:59.999 Bogotá). Devuelve el
 * instante UTC correspondiente.
 */
export function calcularFreemiumFechaFin(fechaInicio: Date, duracionDias: number): Date {
    const dias = Number.isFinite(duracionDias) && duracionDias > 0 ? Math.floor(duracionDias) : 0;
    const inicioPared = toZonedTime(fechaInicio, ZONA_BOGOTA);
    const finPared = endOfDay(addDays(startOfDay(inicioPared), dias));
    return fromZonedTime(finPared, ZONA_BOGOTA);
}

/**
 * FR-005 / contrato: al autorizar un pago durante freemium,
 * `fechaFin = max(freemiumFechaFin, hoy Bogotá) + duracionCubierta` (meses).
 * Si el freemium ya venció, la base es la fecha de autorización (sin prorrateo,
 * Decisión 2 de la spec).
 */
export function calcularFechaFinTrasPagoFreemium(input: {
    freemiumFechaFin: Date;
    ahora: Date;
    duracionCubierta: DuracionPlan;
}): Date {
    const base = input.freemiumFechaFin.getTime() > input.ahora.getTime() ? input.freemiumFechaFin : input.ahora;
    // SPEC-794 · FR-003: la suma de meses es en el día calendario Bogotá, NO sobre el instante UTC
    // crudo. `freemiumFechaFin` es fin-de-día Bogotá guardado como 04:59:59.999Z — o sea el día
    // SIGUIENTE en UTC. Sumar meses sobre el instante crudo (addMonths directo) recorta sobre el
    // calendario equivocado cerca de fin de mes (un día que en UTC es 31 y en Bogotá es 30) y le
    // resta un día de servicio al cliente que pagó. Convertir a Bogotá primero (como el hermano
    // `calcularFreemiumFechaFin`) hace que el clamp caiga en el calendario correcto.
    const basePared = toZonedTime(base, ZONA_BOGOTA);
    return fromZonedTime(addMonths(basePared, mesesDeDuracion(input.duracionCubierta)), ZONA_BOGOTA);
}

/**
 * Días calendario Bogotá que quedan de freemium (0 si ya venció). Null cuando
 * la suscripción no está en freemium o no tiene fecha de fin freemium.
 */
export function calcularDiasRestantesFreemium(
    esFreemium: boolean,
    freemiumFechaFin: Date | null,
    ahora: Date = new Date()
): number | null {
    if (!esFreemium || !freemiumFechaFin) return null;
    return Math.max(0, calcularDiasRestantesBogota(freemiumFechaFin, ahora));
}
