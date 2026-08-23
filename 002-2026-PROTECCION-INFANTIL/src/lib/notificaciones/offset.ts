/**
 * SPEC-201 (BRIEF §6): parser de offsets ISO8601 signed para el motor de
 * notificaciones. Formatos soportados: `-5d`, `-1d`, `+2d`, `+3d`, `+0m`, etc.
 * Unidades: `d` = días, `h` = horas, `m` = minutos.
 *
 * Toda la aritmética temporal se realiza en `America/Bogota` (D-69, SPEC-200).
 */
import { addDays, addHours, addMinutes } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const TIMEZONE_MOTOR = "America/Bogota";

export type UnidadOffset = "d" | "h" | "m";

export interface OffsetParseado {
    signo: 1 | -1;
    cantidad: number;
    unidad: UnidadOffset;
}

/**
 * Valida y parsea un offset con signo.
 * Ejemplos válidos: `-5d`, `+2d`, `-1h`, `+30m`, `+0m`.
 */
export function parseOffset(offset: string): OffsetParseado {
    const match = offset.trim().match(/^([+-])(\d+)([dhm])$/);
    if (!match) {
        throw new Error(`Offset inválido: "${offset}". Se espera formato [+-]N[d|h|m].`);
    }

    const signo = match[1] === "+" ? 1 : -1;
    const cantidad = parseInt(match[2], 10);
    const unidad = match[3] as UnidadOffset;

    if (!Number.isFinite(cantidad) || cantidad < 0) {
        throw new Error("Offset inválido: cantidad debe ser un entero >= 0.");
    }

    return { signo, cantidad, unidad };
}

/**
 * Aplica un offset a una fecha de referencia usando aritmética en Bogotá.
 * Para unidades de día se conserva la hora local de Bogotá de la referencia.
 */
export function aplicarOffset(referencia: Date, offset: string): Date {
    const parsed = parseOffset(offset);
    const cantidad = parsed.signo * parsed.cantidad;

    if (parsed.cantidad === 0) {
        return new Date(referencia.getTime());
    }

    if (parsed.unidad === "d") {
        // Convertir a hora Bogotá, sumar/restar días calendario, volver a UTC.
        const zoned = toZonedTime(referencia, TIMEZONE_MOTOR);
        const resultZoned = addDays(zoned, cantidad);
        return fromZonedTime(resultZoned, TIMEZONE_MOTOR);
    }

    if (parsed.unidad === "h") {
        return addHours(referencia, cantidad);
    }

    return addMinutes(referencia, cantidad);
}
