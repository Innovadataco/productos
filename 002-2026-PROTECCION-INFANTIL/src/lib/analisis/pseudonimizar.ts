/**
 * SPEC-227 (002-PI-128): pseudonimización del sujeto en el export CSV (FR-007,
 * Ley 1581). SHA-256(`sujetoId` + sal de servidor) truncado a 16 hex:
 * irreversible, estable entre exports (permite correlacionar filas del mismo
 * cliente sin exponer el id crudo). La sal vive SOLO en la variable de entorno
 * `ANALISIS_EXPORT_SALT` (I-22). Módulo puro.
 */
import { createHash } from "crypto";

/**
 * Devuelve el hash opaco del sujeto, o `null` si la recomendación no tiene
 * sujeto. FAIL-CLOSED: sin sal definida lanza (nunca exporta el id crudo).
 */
export function pseudonimizarSujeto(sujetoId: string | null, sal: string | undefined): string | null {
    if (sujetoId === null) return null;
    if (!sal || sal.length === 0) {
        throw new Error("ANALISIS_EXPORT_SALT no está definida: export cancelado (fail-closed)");
    }
    return createHash("sha256").update(sujetoId + sal).digest("hex").slice(0, 16);
}
