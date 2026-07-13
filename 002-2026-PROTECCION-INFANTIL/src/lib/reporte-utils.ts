/**
 * Utilidades para el módulo de reportes
 */

const SEGUIMIENTO_PREFIX = "RPT";
const SEGUIMIENTO_LENGTH = 6;
const SEGUIMIENTO_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generarNumeroSeguimiento(): string {
    let result = SEGUIMIENTO_PREFIX + "-";
    for (let i = 0; i < SEGUIMIENTO_LENGTH; i++) {
        result += SEGUIMIENTO_CHARS.charAt(
            Math.floor(Math.random() * SEGUIMIENTO_CHARS.length)
        );
    }
    return result;
}