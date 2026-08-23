import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import { logger } from "@/lib/logger";
import { estaIpBloqueada } from "./anti-abuso/block-list";
import { calcularIpHash } from "./anti-abuso/fuente-reporte";
import { evaluarYAlertarRateLimit } from "./anti-abuso/rate-limit-alerts";
import type { PrismaClient } from "@prisma/client";

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
    softExceeded?: boolean | undefined;
    /**
     * Solo para scopes suaves. Sugiere marcar el recurso como POSIBLE_SPAM
     * porque el contador superó el umbral de spam configurado.
     */
    markAsSpam?: boolean | undefined;
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
    circulo_contacto: { windowSeconds: 3600, maxRequests: 20 },
    recuperar_solicitar: { windowSeconds: 3600, maxRequests: 5 },
    verificacion_solicitar: { windowSeconds: 3600, maxRequests: 5 },
    ciudades_buscar: { windowSeconds: 60, maxRequests: 60 },
    // SPEC-216 (002-PI-116): escrituras del módulo de pagos (aplicar bono, etc.).
    pagos_write: { windowSeconds: 60, maxRequests: 30 },
    session_ping: { windowSeconds: 60, maxRequests: 60 },
    verificar_pdf: { windowSeconds: 60, maxRequests: 30 },
    // SPEC-235 (002-PI-135): consulta pública de guías de acción.
    guias_accion_publica: { windowSeconds: 60, maxRequests: 30 },
};

export function getScopeDefaults(scope: string): ScopeDefaults {
    return DEFAULTS[scope] || { windowSeconds: 60, maxRequests: 30 };
}

/**
 * Scopes sensibles a abuso de credenciales/identificadores que DEBEN fallar
 * cerrado si el store de rate limiting no responde (I-28). El resto de scopes
 * mantiene el comportamiento fail-open para no bloquear la aplicación.
 */
const FAIL_CLOSED_SCOPES = new Set(["seguimiento", "login"]);

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
    options?: { identifier?: string | undefined; soft?: boolean | undefined; client?: PrismaClient | undefined }
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

    // SPEC-184: consultar BlockList antes de contar. Si la IP está bloqueada,
    // devolvemos 429 inmediato sin incrementar el contador de RateLimit.
    try {
        const clientIp = getClientIp(request);
        const ipHash = calcularIpHash(clientIp);
        if (await estaIpBloqueada(ipHash)) {
            const defaults = getScopeDefaults(scope);
            const resetAt = Date.now() + defaults.windowSeconds * 1000;
            const headers: Record<string, string> = {
                "X-RateLimit-Limit": String(defaults.maxRequests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
                "Retry-After": String(defaults.windowSeconds),
            };
            return {
                allowed: false,
                limit: defaults.maxRequests,
                remaining: 0,
                resetAt,
                headers,
            };
        }
    } catch (error) {
        logger.error("[RATE-LIMIT] Error consultando BlockList:", error);
        // Fail-open: si no podemos verificar la blocklist, no bloqueamos todo el tráfico.
    }

    try {
        // O-1 (SPEC-108): la config se lee DENTRO del try. Con Postgres caído, los scopes
        // de FAIL_CLOSED_SCOPES deben responder 429 + Retry-After (SPEC-103), no 500.
        const config = await getScopeConfig(scope);
        const windowMs = config.windowSeconds * 1000;
        const now = Date.now();
        const windowStartMs = Math.floor(now / windowMs) * windowMs;
        const resetAt = windowStartMs + windowMs;
        const key = `${scope}:${identifier}:${windowStartMs}`;
        // SPEC-174: cliente inyectable SOLO para tests (simular store caído sin
        // espiar el singleton de Prisma — la regla arch:check (e) lo prohíbe).
        const db = options?.client ?? prisma;
        // Atomic upsert: crea la ventana o incrementa el contador
        const rows = await db.$queryRaw<{ count: number }[]>`
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
            // SPEC-184: alerta throttled cuando una IP acumula muchos bloqueos.
            void evaluarYAlertarRateLimit({
                scope,
                identifier,
                ipHash: calcularIpHash(getClientIp(request)),
                maxRequests: config.maxRequests,
            });
        }

        // Limpieza periódica de ventanas antiguas (probabilidad 1%)
        if (Math.random() < 0.01) {
            cleanupOldWindows(scope).catch(() => {
                // Ignorar errores de limpieza
            });
        }

        return { allowed, limit: config.maxRequests, remaining, resetAt, headers };
    } catch (error) {
        // Fallo del limitador: fail-open por defecto; los scopes de
        // FAIL_CLOSED_SCOPES fallan cerrado (bloquean) ante un store caído.
        // Defaults sincrónicos (sin BD): el catch también debe funcionar con Postgres caído.
        logger.error("[RATE-LIMIT] Error consultando límite:", error);
        const failClosed = FAIL_CLOSED_SCOPES.has(scope);
        const defaults = getScopeDefaults(scope);
        const resetAt = Date.now() + defaults.windowSeconds * 1000;
        const headers: Record<string, string> = {
            "X-RateLimit-Limit": String(defaults.maxRequests),
            "X-RateLimit-Remaining": String(failClosed ? 0 : defaults.maxRequests),
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        };
        if (failClosed) {
            headers["Retry-After"] = String(Math.ceil((resetAt - Date.now()) / 1000));
        }
        return {
            allowed: !failClosed,
            limit: defaults.maxRequests,
            remaining: failClosed ? 0 : defaults.maxRequests,
            resetAt,
            headers,
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
