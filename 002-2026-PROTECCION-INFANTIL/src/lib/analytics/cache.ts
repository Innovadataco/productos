/**
 * SPEC-194 (002-PI-088): caché en memoria para endpoints de analítica de colegios.
 * TTL configurable vía ParametroSistema `analytics.colegios.cache_ttl_min`.
 * Sin dependencias externas (Map nativo). La invalidación es por TTL; cambios manuales
 * en BD quedan visibles cuando expire la entrada.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheKey(namespace: string, ...parts: (string | number | boolean | undefined | null)[]): string {
    const sanitized = parts
        .filter((p) => p !== undefined && p !== null)
        .map((p) => String(p).replace(/:/g, "_"));
    return `${namespace}:${sanitized.join(":")}`;
}

export function getCache<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
    store.clear();
}

export function ttlDesdeMinutos(min: number): number {
    return Math.max(0, min) * 60 * 1000;
}
