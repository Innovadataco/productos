import { prisma } from "./prisma";

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    headers: Record<string, string>;
}

interface ScopeDefaults {
    windowSeconds: number;
    maxRequests: number;
}

const DEFAULTS: Record<string, ScopeDefaults> = {
    report: { windowSeconds: 3600, maxRequests: 5 },
    login: { windowSeconds: 300, maxRequests: 10 },
    consulta: { windowSeconds: 60, maxRequests: 30 },
    register: { windowSeconds: 3600, maxRequests: 10 },
};

function getScopeDefaults(scope: string): ScopeDefaults {
    return DEFAULTS[scope] || { windowSeconds: 60, maxRequests: 30 };
}

async function getScopeConfig(scope: string): Promise<ScopeDefaults> {
    const defaults = getScopeDefaults(scope);
    const [windowParam, maxParam] = await Promise.all([
        prisma.parametroSistema.findUnique({ where: { clave: `ratelimit.${scope}.window_seconds` } }),
        prisma.parametroSistema.findUnique({ where: { clave: `ratelimit.${scope}.max_requests` } }),
    ]);

    return {
        windowSeconds: windowParam ? parseInt(windowParam.valor, 10) || defaults.windowSeconds : defaults.windowSeconds,
        maxRequests: maxParam ? parseInt(maxParam.valor, 10) || defaults.maxRequests : defaults.maxRequests,
    };
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

/**
 * Rate limiting basado en PostgreSQL con ventana fija.
 * Usa INSERT ... ON CONFLICT para atomicidad.
 */
export async function checkRateLimit(
    request: Request,
    scope: string,
    options?: { identifier?: string }
): Promise<RateLimitResult> {
    if (process.env.DISABLE_RATE_LIMIT === "true") {
        return {
            allowed: true,
            limit: 0,
            remaining: 0,
            resetAt: Date.now() + 60 * 1000,
            headers: {},
        };
    }

    const identifier = options?.identifier ?? getClientIp(request);
    const config = await getScopeConfig(scope);
    const windowMs = config.windowSeconds * 1000;
    const now = Date.now();
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStartMs + windowMs;
    const key = `${scope}:${identifier}:${windowStartMs}`;

    try {
        // Atomic upsert: crea la ventana o incrementa el contador
        const rows = await prisma.$queryRaw<{ count: number }[]>`
            INSERT INTO "RateLimit" (key, scope, identifier, "windowStart", count, "createdAt", "actualizadoEn")
            VALUES (${key}, ${scope}, ${identifier}, ${new Date(windowStartMs)}, 1, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET
                count = "RateLimit".count + 1,
                "actualizadoEn" = NOW()
            RETURNING count;
        `;

        const count = rows[0]?.count ?? 1;
        const allowed = count <= config.maxRequests;
        const remaining = Math.max(config.maxRequests - count, 0);

        const headers: Record<string, string> = {
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        };

        if (!allowed) {
            headers["Retry-After"] = String(Math.ceil((resetAt - now) / 1000));
        }

        // Limpieza periódica de ventanas antiguas (probabilidad 1%)
        if (Math.random() < 0.01) {
            cleanupOldWindows(scope).catch(() => {
                // Ignorar errores de limpieza
            });
        }

        return { allowed, limit: config.maxRequests, remaining, resetAt, headers };
    } catch (error) {
        // Fallo del limitador no debe bloquear la aplicación
        console.error("[RATE-LIMIT] Error consultando límite:", error);
        return {
            allowed: true,
            limit: config.maxRequests,
            remaining: config.maxRequests,
            resetAt,
            headers: {
                "X-RateLimit-Limit": String(config.maxRequests),
                "X-RateLimit-Remaining": String(config.maxRequests),
                "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            },
        };
    }
}

async function cleanupOldWindows(scope: string): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimit.deleteMany({
        where: {
            scope,
            windowStart: { lt: cutoff },
        },
    });
}

export async function resetRateLimitStore(): Promise<void> {
    await prisma.rateLimit.deleteMany();
}
