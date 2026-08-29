import { formatInTimeZone } from "date-fns-tz";

/**
 * SPEC-200 — Helpers de formateo de fecha/hora fijos en America/Bogota.
 *
 * Centraliza toda llamada a `toLocaleString` / `toLocaleDateString` /
 * `toLocaleTimeString` / `Intl.DateTimeFormat` para evitar duplicar la timezone
 * y garantizar que el usuario siempre vea hora de Bogotá (D-69).
 */

export const TIMEZONE_BOGOTA = "America/Bogota";
export const LOCALE_BOGOTA = "es-CO";

function toDate(fecha: Date | string | number): Date {
    const d = typeof fecha === "number" ? new Date(fecha) : new Date(fecha);
    return d;
}

function withTimeZone(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
    return { ...options, timeZone: TIMEZONE_BOGOTA };
}

export function formatoFechaBogota(
    fecha: Date | string | number,
    options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
    return toDate(fecha).toLocaleDateString(LOCALE_BOGOTA, withTimeZone(options));
}

export function formatoFechaHoraBogota(
    fecha: Date | string | number,
    options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "medium" }
): string {
    return toDate(fecha).toLocaleString(LOCALE_BOGOTA, withTimeZone(options));
}

export function formatoFechaLargaBogota(
    fecha: Date | string | number,
    options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
): string {
    return toDate(fecha).toLocaleDateString(LOCALE_BOGOTA, withTimeZone(options));
}

export function formatoHoraBogota(
    fecha: Date | string | number,
    options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
    return toDate(fecha).toLocaleTimeString(LOCALE_BOGOTA, withTimeZone(options));
}

export function crearDateTimeFormatBogota(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(LOCALE_BOGOTA, withTimeZone(options));
}

/**
 * Día calendario en America/Bogota como Date UTC a medianoche.
 * Equivalente a `diaBogota` de `src/lib/colegio/avisos.ts` pero sin depender
 * de repositorios; se puede usar en cualquier capa.
 */
export function diaCalendarioBogota(fecha: Date | string | number = new Date()): Date {
    const iso = formatInTimeZone(toDate(fecha), TIMEZONE_BOGOTA, "yyyy-MM-dd");
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
}
