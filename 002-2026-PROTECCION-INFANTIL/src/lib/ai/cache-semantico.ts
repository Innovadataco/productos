/**
 * SPEC-195 (002-PI-089): caché semántico humano exacto.
 *
 * La lógica de acceso a BD vive en `src/lib/dal/repositories/cache-semantico.ts`;
 * este archivo conserva la interfaz pública y delega.
 */
import {
    CacheSemanticoRepository,
    type CacheSemanticoHit,
    type CacheSemanticoMiss,
    type CacheSemanticoResult,
    type OpcionesCacheSemantico,
} from "@/lib/dal/repositories/cache-semantico";

export type { CacheSemanticoHit, CacheSemanticoMiss, CacheSemanticoResult, OpcionesCacheSemantico };

const repo = new CacheSemanticoRepository();

/**
 * Busca un reporte previo con embedding similar cuya clasificación haya sido
 * confirmada o corregida por un humano.
 *
 * El anti-abuso (ráfaga/duplicado) debe cortar ANTES de llamar a esta función.
 */
export async function buscarClasificacionCache(
    embedding: number[],
    opciones: OpcionesCacheSemantico
): Promise<CacheSemanticoResult> {
    return repo.buscarClasificacionCache(embedding, opciones);
}

/**
 * Persiste una clasificación heredada por caché humano y devuelve el resultado
 * en la forma que espera el resto del pipeline.
 */
export async function persistirClasificacionCache(
    reporteId: string,
    hit: CacheSemanticoHit
) {
    return repo.persistirClasificacionCache(reporteId, hit);
}
