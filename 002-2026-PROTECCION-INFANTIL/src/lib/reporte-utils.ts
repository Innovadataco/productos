/**
 * Utilidades para el módulo de reportes
 */
import { randomInt } from "node:crypto";

const SEGUIMIENTO_PREFIX = "RPT";
const SEGUIMIENTO_LENGTH = 6;
const SEGUIMIENTO_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Número de seguimiento público (RPT-XXXXXX). E-6: CSPRNG (crypto.randomInt)
 * en vez de Math.random — el RPT es un identificador de seguridad (permite el
 * seguimiento del caso) y no debe ser predecible. Mismo formato, longitud y
 * charset que antes; la distribución uniforme queda idéntica.
 */
export function generarNumeroSeguimiento(): string {
    let result = SEGUIMIENTO_PREFIX + "-";
    for (let i = 0; i < SEGUIMIENTO_LENGTH; i++) {
        result += SEGUIMIENTO_CHARS.charAt(randomInt(SEGUIMIENTO_CHARS.length));
    }
    return result;
}
