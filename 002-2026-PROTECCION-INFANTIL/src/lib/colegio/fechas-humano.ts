/**
 * SPEC-143 + SPEC-200 — Fechas en lenguaje humano con timezone fijo America/Bogota.
 * - `fechaLargaES`: "viernes 21 de agosto de 2026".
 * - `relativoHumano`: "hace 12 minutos" / "hace 3 horas" / "hace 2 días".
 * - `etiquetaPeriodo`: etiqueta corta para ejes/tooltips de tendencia.
 *
 * Toda la presentación usa `date-fns-tz` sobre `America/Bogota` para que el día
 * calendario no dependa de la timezone del runtime (bug de medianoche, D-69).
 */

import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

export const TIMEZONE_BOGOTA = "America/Bogota";

const TZ = TIMEZONE_BOGOTA;

const MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

export function fechaLargaES(fecha: Date): string {
    return formatInTimeZone(fecha, TZ, "eeee d 'de' MMMM 'de' yyyy", { locale: es });
}

function plural(cantidad: number, singular: string, pluralForma: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`;
}

/**
 * Devuelve la fecha/hora de Bogota como string ISO "YYYY-MM-DDTHH:mm:ss".
 * Útil para comparar días calendario sin depender de la timezone del runtime.
 */
export function isoBogota(fecha: Date): string {
    return formatInTimeZone(fecha, TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

export function diaCalendarioBogota(fecha: Date): string {
    return formatInTimeZone(fecha, TZ, "yyyy-MM-dd");
}

export function relativoHumano(fecha: Date, ahora: Date = new Date()): string {
    const ms = ahora.getTime() - fecha.getTime();
    if (ms < 0) return "justo ahora";

    const minutos = Math.floor(ms / 60_000);
    if (minutos < 1) return "hace un momento";
    if (minutos < 60) return `hace ${plural(minutos, "minuto", "minutos")}`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${plural(horas, "hora", "horas")}`;

    // SPEC-200: "hace N días" usa el día calendario en Bogotá, no 24 h exactas.
    const dias = Math.floor(horas / 24);
    if (dias < 60) return `hace ${plural(dias, "día", "días")}`;

    return formatInTimeZone(fecha, TZ, "'el' d MMM yyyy", { locale: es });
}

export type GranularidadTendencia = "semanal" | "mensual" | "anual";

/**
 * Etiqueta corta de un punto de la tendencia. `periodo` es la fecha ISO de inicio
 * del periodo (lunes de la semana / día 1 del mes / 1 de enero del año).
 *
 * Los periodos se almacenan en UTC; conservamos su interpretación UTC para no
 * desplazar la etiqueta (ej. "sep 2026" para 2026-09-01T00:00:00.000Z).
 */
export function etiquetaPeriodo(periodo: string, granularidad: GranularidadTendencia): string {
    const fecha = new Date(periodo);
    if (Number.isNaN(fecha.getTime())) return periodo;
    if (granularidad === "anual") return String(fecha.getUTCFullYear());
    if (granularidad === "mensual") return `${MESES_CORTOS[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
    return `${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()]}`;
}
