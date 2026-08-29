/**
 * SPEC-225 (002-PI-126): ventanas temporales del detector de anomalías.
 * Los cortes semanales son de semana CALENDARIO America/Bogota (lunes 00:00 a
 * domingo 23:59:59.999), nunca UTC (edge case del spec: un pago autorizado a
 * las 23:59 del domingo cuenta en la semana que cierra). Funciones puras;
 * patrón de `src/lib/analisis/periodos.ts` (SPEC-220).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ZONA_BOGOTA } from "../periodos";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Rango `[desde, hasta)` en instantes UTC de una semana calendario Bogotá. */
export interface RangoSemana {
    desde: Date;
    hasta: Date;
    /** "YYYY-MM-DD" del lunes que abre la semana (día calendario Bogotá). */
    claveInicio: string;
    /** "YYYY-MM-DD" del domingo que cierra la semana (día calendario Bogotá). */
    claveFin: string;
}

/**
 * Semana calendario Bogotá que contiene `ahora`: desde el lunes 00:00 hasta
 * el lunes siguiente 00:00 (exclusivo), en instantes UTC.
 */
export function semanaCalendarioBogota(ahora: Date = new Date()): RangoSemana {
    // Día de semana ISO en Bogotá (1 = lunes … 7 = domingo) y fecha calendario.
    const diaSemanaIso = parseInt(formatInTimeZone(ahora, ZONA_BOGOTA, "i"), 10);
    const fechaBogota = formatInTimeZone(ahora, ZONA_BOGOTA, "yyyy-MM-dd");
    const [anio, mes, dia] = fechaBogota.split("-").map((p) => parseInt(p, 10)) as [
        number,
        number,
        number,
    ];
    // Aritmética de días calendario sobre la fecha Bogotá (segura en UTC puro).
    const baseUtc = Date.UTC(anio, mes - 1, dia);
    const lunesUtc = baseUtc - (diaSemanaIso - 1) * DIA_MS;
    const domingoUtc = lunesUtc + 6 * DIA_MS;
    const siguienteLunesUtc = lunesUtc + 7 * DIA_MS;

    const claveInicio = new Date(lunesUtc).toISOString().slice(0, 10);
    const claveFin = new Date(domingoUtc).toISOString().slice(0, 10);
    const claveSiguiente = new Date(siguienteLunesUtc).toISOString().slice(0, 10);

    return {
        desde: fromZonedTime(`${claveInicio}T00:00:00`, ZONA_BOGOTA),
        hasta: fromZonedTime(`${claveSiguiente}T00:00:00`, ZONA_BOGOTA),
        claveInicio,
        claveFin,
    };
}

/** Semana calendario Bogotá inmediatamente anterior a la dada. */
export function semanaAnterior(semana: RangoSemana): RangoSemana {
    const lunesUtc = Date.parse(`${semana.claveInicio}T00:00:00Z`) - 7 * DIA_MS;
    const domingoUtc = lunesUtc + 6 * DIA_MS;
    const claveInicio = new Date(lunesUtc).toISOString().slice(0, 10);
    const claveFin = new Date(domingoUtc).toISOString().slice(0, 10);
    return {
        desde: fromZonedTime(`${claveInicio}T00:00:00`, ZONA_BOGOTA),
        hasta: semana.desde,
        claveInicio,
        claveFin,
    };
}

/** Ventana móvil de las últimas 24 horas (cancelaciones masivas / recientes). */
export function ultimas24h(ahora: Date = new Date()): { desde: Date; hasta: Date } {
    return { desde: new Date(ahora.getTime() - DIA_MS), hasta: ahora };
}
