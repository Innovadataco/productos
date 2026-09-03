-- Aditiva: contador de rate limiting PROPIO de BI (tabla bi_rate_limit).
-- Auditoría de seguridad BI vs PI 2026-09-03: el login de BI (expuesto a
-- internet, una sola cuenta) no tenía freno a los intentos. Port del patrón
-- de PI (002 src/lib/rate-limit.ts) sobre tabla propia: la "RateLimit" que
-- ya existe en bi-db es RÉPLICA de solo lectura de PI — no se escribe jamás.

CREATE TABLE IF NOT EXISTS "bi_rate_limit" (
    "key"         TEXT        NOT NULL,
    "scope"       TEXT        NOT NULL,
    "identifier"  TEXT        NOT NULL,
    "windowStart" TIMESTAMPTZ NOT NULL,
    "count"       INTEGER     NOT NULL DEFAULT 0,
    "creadoEn"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_rate_limit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "bi_rate_limit_scope_identifier_windowStart_idx"
    ON "bi_rate_limit" ("scope", "identifier", "windowStart");
