/**
 * Rate limiting simple en memoria para reportes anónimos
 * Limpieza automática de entradas expiradas
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_REQUESTS = 5; // 5 reportes por hora por IP

function getKey(ip: string): string {
    return `ratelimit:${ip}`;
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const key = getKey(ip);
    const entry = store.get(key);

    // Limpiar entradas expiradas periódicamente
    if (Math.random() < 0.01) {
        cleanup();
    }

    if (!entry || entry.resetAt < now) {
        // Nueva ventana
        store.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: now + WINDOW_MS };
    }

    if (entry.count >= MAX_REQUESTS) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) {
            store.delete(key);
        }
    }
}

export function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp;
    return "unknown";
}