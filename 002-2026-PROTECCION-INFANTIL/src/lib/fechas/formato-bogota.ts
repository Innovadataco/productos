import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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

/**
 * SPEC-447 (I-311): el camino INVERSO — de la hora de pared que escribe una
 * persona en Bogotá al instante UTC que se guarda.
 *
 * Vive acá, con el resto de la zona horaria, y no en la pantalla: la lección de
 * I-247 es que un offset copiado a mano se desincroniza en silencio. Usa
 * `fromZonedTime` en vez de restar cinco horas a mano — si algún día Colombia
 * cambiara de offset, la biblioteca lo sabe y una constante nuestra no.
 *
 * @param dia  "YYYY-MM-DD" tal cual lo escribe un `<input type="date">`.
 * @param hora "HH:mm" tal cual lo escribe un `<input type="time">`.
 * @throws si el texto no tiene la forma esperada — un instante mal formado que
 *         se guarda callado es peor que un error.
 */
export function instanteDesdeHoraBogota(dia: string, hora: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        throw new Error(`Día inválido: "${dia}" (se esperaba YYYY-MM-DD)`);
    }
    if (!/^\d{2}:\d{2}$/.test(hora)) {
        throw new Error(`Hora inválida: "${hora}" (se esperaba HH:mm)`);
    }
    const instante = fromZonedTime(`${dia}T${hora}:00`, TIMEZONE_BOGOTA);
    if (Number.isNaN(instante.getTime())) {
        throw new Error(`Fecha y hora inválidas: "${dia} ${hora}"`);
    }
    return instante;
}

/** El mismo instante, sumándole minutos. Para derivar el fin desde la duración del perfil. */
export function sumarMinutos(instante: Date, minutos: number): Date {
    return new Date(instante.getTime() + minutos * 60 * 1000);
}
