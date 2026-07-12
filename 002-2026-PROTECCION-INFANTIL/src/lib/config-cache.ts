const cache = new Map<string, { value: unknown; expiresAt: number }>();
const TTL_MS = 60_000; // 1 minuto

export function getCached<T>(key: string): T | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return undefined;
    }
    return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateCache(key?: string): void {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
}