-- Aditiva: bitácora general de BI (SPEC-006 · 2026-09-02).
-- Eventos de gobierno del producto (login OK/fallido, cambios de config,
-- exportaciones) — distinta de bi_consulta_log, que es solo del chat.
-- detalle: JSON chico en TEXT (misma convención que pasosJson/planJson).
CREATE TABLE IF NOT EXISTS "bi_audit_log" (
    "id"        TEXT        NOT NULL,
    "accion"   TEXT        NOT NULL,
    "email"    TEXT        NOT NULL,
    "detalle"  TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bi_audit_log_accion_creadoEn_idx" ON "bi_audit_log"("accion", "creadoEn");
CREATE INDEX IF NOT EXISTS "bi_audit_log_creadoEn_idx" ON "bi_audit_log"("creadoEn");
