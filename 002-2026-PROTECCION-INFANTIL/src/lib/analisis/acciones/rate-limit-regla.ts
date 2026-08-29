/**
 * SPEC-226 (002-PI-mega-cola, FR-009): rate-limit por regla del ejecutor de
 * acciones. Reutiliza `checkRateLimit` con scope `analisis_accion` e
 * `identifier = reglaId` (cada regla tiene su propio contador; las aplicaciones
 * manuales también cuentan). Los topes se configuran por `ParametroSistema`
 * (`ratelimit.analisis_accion.window_seconds|max_requests`, sembrados en seed).
 * El limitador es fail-open (I-28): el tope duro real es la dedup de SPEC-221.
 *
 * La invocación es interna (worker/servicio): se usa un Request sintético sin
 * IP real; el conteo se hace por regla, nunca por IP.
 */
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

export const SCOPE_ANALISIS_ACCION = "analisis_accion";

export function verificarRateLimitRegla(reglaId: string): Promise<RateLimitResult> {
    const requestSintetico = new Request("http://localhost/internal/analisis-accion");
    return checkRateLimit(requestSintetico, SCOPE_ANALISIS_ACCION, { identifier: reglaId });
}
