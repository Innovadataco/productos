// src/lib/rate-limit.ts · Ventanas fijas de rate limiting en PostgreSQL
// Producto 006 · BI v2 · Auditoría de seguridad BI vs PI 2026-09-03
// Port del patrón de PI (002 · src/lib/rate-limit.ts, referencia SOLO
// LECTURA) sobre la tabla PROPIA bi_rate_limit — la "RateLimit" que existe en
// bi-db es réplica de solo lectura de PI y jamás se escribe.
//
// Semántica (igual que PI):
//   · Ventana fija: key = "{scope}:{identifier}:{windowStartMs}"; el upsert
//     atómico (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) es el contador.
//   · Identifier: IP del cliente (x-forwarded-for → x-real-ip → "unknown").
//   · Defaults por scope: login = 10 intentos / 5 min; resto 30 / 1 min.
//   · Overrides configurables en bi_config (B3): ratelimit.{scope}.max_requests
//     y ratelimit.{scope}.window_seconds — leídos dentro del try.
//   · login falla CERRADO (429) si el store está caído: un login sin freno
//     por caída del limitador es peor que uno temporalmente cerrado.
//   · DISABLE_RATE_LIMIT=true desactiva todo (E2E local, como en PI).
//   · Limpieza probabilística (1%) de ventanas con más de 24 h.

import { Prisma, type PrismaClient } from "@prisma/client";
import { getConfig } from "./config";

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    headers: Record<string, string>;
}

interface ScopeConfig {
    windowSeconds: number;
    maxRequests: number;
}

/** Defaults por scope. login: 10 intentos por cada 5 minutos (patrón PI). */
const DEFAULTS_POR_SCOPE: Record<string, ScopeConfig> = {
    login: { windowSeconds: 300, maxRequests: 10 },
};

const FALLBACK: ScopeConfig = { windowSeconds: 60, maxRequests: 30 };

/** Scopes que fallan CERRADOS si el store no responde (no se deja pasar). */
const FAIL_CLOSED_SCOPES = new Set(["login"]);

/** Límite de edad para la limpieza probabilística de ventanas (24 h). */
const VIDA_MAX_VENTANA_MS = 24 * 60 * 60 * 1000;

function configDeScope(scope: string): ScopeConfig {
    return DEFAULTS_POR_SCOPE[scope] ?? FALLBACK;
}

async function configOverride(scope: string): Promise<ScopeConfig | null> {
    // B3: overrides en bi_config, igual que PI lee ParametroSistema. Cualquier
    // valor inválido se ignora y se cae al default (jamás tumbar el login por
    // un parámetro mal escrito).
    try {
        const base = configDeScope(scope);
        const maxRaw = (await getConfig(`ratelimit.${scope}.max_requests`))?.trim();
        const winRaw = (await getConfig(`ratelimit.${scope}.window_seconds`))?.trim();
        const maxRequests = maxRaw ? Number(maxRaw) : NaN;
        const windowSeconds = winRaw ? Number(winRaw) : NaN;
        return {
            maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? Math.floor(maxRequests) : base.maxRequests,
            windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? Math.floor(windowSeconds) : base.windowSeconds,
        };
    } catch {
        return null; // bi_config no disponible: el caller usa los defaults
    }
}

/** IP del cliente detrás del proxy (D4 de PI: request.url miente; el header no). */
function getClientIp(request: Request): string {
    const fwd = request.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function headersDe(cfg: ScopeConfig, count: number, resetAt: number, allowed: boolean): Record<string, string> {
    const remaining = Math.max(0, cfg.maxRequests - count);
    const h: Record<string, string> = {
        "X-RateLimit-Limit": String(cfg.maxRequests),
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    };
    if (!allowed) h["Retry-After"] = String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
    return h;
}

/**
 * Freno de intentos por ventana fija. Incrementa SIEMPRE (allowed o no) —
 * el contador es el gasto del intento, no del éxito.
 */
export async function checkRateLimit(
    request: Request,
    scope: string,
    options?: { identifier?: string | undefined; client?: PrismaClient | undefined },
): Promise<RateLimitResult> {
    const ahora = Date.now();

    if (process.env.DISABLE_RATE_LIMIT === "true") {
        return { allowed: true, limit: 0, remaining: 0, resetAt: ahora, headers: {} };
    }

    const override = await configOverride(scope);
    const cfg = override ?? configDeScope(scope);
    const identifier = options?.identifier ?? getClientIp(request);

    const windowMs = cfg.windowSeconds * 1000;
    const windowStartMs = Math.floor(ahora / windowMs) * windowMs;
    const resetAt = windowStartMs + windowMs;
    const key = `${scope}:${identifier}:${windowStartMs}`;

    const client = options?.client ?? (await import("./db")).prisma;

    try {
        const filas = await client.$queryRaw<Array<{ count: number }>>(
            Prisma.raw(
                `INSERT INTO "bi_rate_limit" ("key", "scope", "identifier", "windowStart", "count") ` +
                    `VALUES ('${key}', '${scope}', '${identifier}', to_timestamp(${windowStartMs / 1000}), 1) ` +
                    `ON CONFLICT ("key") DO UPDATE SET "count" = "bi_rate_limit"."count" + 1 ` +
                    `RETURNING "count"`,
            ),
        );
        const count = filas[0]?.count ?? 1;
        const allowed = count <= cfg.maxRequests;

        // Limpieza probabilística: 1% de las llamadas barre ventanas > 24 h
        // para que la tabla no crezca sin techo (mismo criterio que PI).
        if (Math.random() < 0.01) {
            await client.$executeRaw(
                Prisma.raw(
                    `DELETE FROM "bi_rate_limit" WHERE "windowStart" < to_timestamp(${(ahora - VIDA_MAX_VENTANA_MS) / 1000})`,
                ),
            );
        }

        return {
            allowed,
            limit: cfg.maxRequests,
            remaining: Math.max(0, cfg.maxRequests - count),
            resetAt,
            headers: headersDe(cfg, count, resetAt, allowed),
        };
    } catch (e) {
        console.error(`[RATE-LIMIT] Store no responde (scope ${scope}): ${e instanceof Error ? e.message : String(e)}`);
        if (FAIL_CLOSED_SCOPES.has(scope)) {
            // Fail-closed (PI): si el contador no se puede consultar, el
            // login se niega — un freno caído no puede volverse puerta abierta.
            return {
                allowed: false,
                limit: cfg.maxRequests,
                remaining: 0,
                resetAt: ahora + windowMs,
                headers: headersDe(cfg, cfg.maxRequests, ahora + windowMs, false),
            };
        }
        return { allowed: true, limit: cfg.maxRequests, remaining: cfg.maxRequests, resetAt: ahora + windowMs, headers: {} };
    }
}
