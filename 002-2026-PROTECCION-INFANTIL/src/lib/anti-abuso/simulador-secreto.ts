import { timingSafeEqual } from "crypto";

/**
 * Valida el header `x-simulacion-secret` contra la variable de entorno
 * `SIMULADOR_ABUSO_SECRET` usando comparación constante en tiempo
 * (crypto.timingSafeEqual) para evitar timing attacks.
 *
 * Específico para SPEC-192 (002-PI-086): permite al worker del simulador
 * saltar el rate-limit por fingerprint sin afectar al público.
 *
 * REGLAS:
 * - Si el env no está definido, el bypass nunca aplica.
 * - Si el header falta o tiene longitud distinta, no aplica.
 * - Nunca se loguea el valor del secret.
 */
export function validarSecretoSimulacion(request: Request): boolean {
    const secret = process.env.SIMULADOR_ABUSO_SECRET;
    if (!secret) return false;

    const header = request.headers.get("x-simulacion-secret");
    if (!header) return false;
    if (header.length !== secret.length) return false;

    try {
        return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
    } catch {
        return false;
    }
}
