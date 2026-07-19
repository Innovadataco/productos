import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import { logger } from "@/lib/logger";

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    headers: Record<string, string>;
    /**
     * Solo para scopes "suaves" (soft: true). Indica que se superó el límite
     * configurado pero la operación sigue permitida; el llamador debe decidir
     * cómo tratar el exceso (por ejemplo, marcar para revisión manual).
     */
    softExceeded?: boolean;
    /**
     * Solo para scopes suaves. Sugiere marcar el recurso como POSIBLE_SPAM
     * porque el contador superó el umbral de spam configurado.
     */
    markAsSpam?: boolean;
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
    ia_sandbox: { windowSeconds: 600, maxRequests: 10 },
    admin_read: { windowSeconds: 60, maxRequests: 60 },
    admin_write: { windowSeconds: 60, maxRequests: 30 },
    seguimiento: { windowSeconds: 60, maxRequests: 10 },
    report_identificador: { windowSeconds: 3600, maxRequests: 10 },
    report_fingerprint: { windowSeconds: 3600, maxRequests: 5 },
    apelacion: { windowSeconds: 86400, maxRequests: 3 },
    apelacion_sms: { windowSeconds: 3600, maxRequests: 3 },
    circulo_contacto: { windowSeconds: 3600, maxRequests: 20 },
};

function getScopeDefaults(scope: string): ScopeDefaults {
    return DEFAULTS[scope] || { windowSeconds: 60, maxRequests: 30 };
}

async function getScopeConfig(scope: string): Promise<ScopeDefaults> {
    const defaults = getScopeDefaults(scope);
    const [windowParam, maxParam] = await Promise.all([
        getParametroSistema(`ratelimit.${scope}.window_seconds`),
        getParametroSistema(`ratelimit.${scope}.max_requests`),
    ]);

    return {
        windowSeconds: windowParam ? parseInt(windowParam.valor, 10) || defaults.windowSeconds : defaults.windowSeconds,
        maxRequests: maxParam ? parseInt(maxParam.valor, 10) || defaults.maxRequests : defaults.maxRequests,
    };
}

async function getSpamThreshold(scope: string): Promise<number | undefined> {
    const param = await getParametroSistema(`ratelimit.${scope}.spam_threshold`);
    if (!param) return undefined;
    const value = parseInt(param.valor, 10);
    return Number.isNaN(value) ? undefined : value;
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
    options?: { identifier?: string; soft?: boolean }
): Promise<RateLimitResult> {
    if (process.env.DISABLE_RATE_LIMIT === "true") {
        return {
            allowed: true,
            limit: 0,
            remaining: 0,
            resetAt: Date.now() + 60 * 1000,
            headers: {},
            softExceeded: options?.soft ? false : undefined,
            markAsSpam: options?.soft ? false : undefined,
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

        const headers: Record<string, string> = {
            "X-RateLimit-Limit": String(config.maxRequests),
            "X-RateLimit-Remaining": String(Math.max(config.maxRequests - count, 0)),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        };

        // Scope suave: nunca rechaza, pero informa si se superó el límite.
        if (options?.soft) {
            const softExceeded = count > config.maxRequests;
            const spamThreshold = await getSpamThreshold(scope);
            const markAsSpam = softExceeded && spamThreshold !== undefined && count >= spamThreshold;
            return { allowed: true, limit: config.maxRequests, remaining: Math.max(config.maxRequests - count, 0), resetAt, headers, softExceeded, markAsSpam };
        }

        const allowed = count <= config.maxRequests;
        const remaining = Math.max(config.maxRequests - count, 0);

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
        logger.error("[RATE-LIMIT] Error consultando límite:", error);
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
