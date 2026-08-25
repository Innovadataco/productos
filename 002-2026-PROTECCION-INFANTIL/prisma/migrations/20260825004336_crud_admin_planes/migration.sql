-- SPEC-243 (002-PI-146): extensión aditiva del catálogo de planes y auditoría.
-- Migración 100% aditiva: solo agrega columnas y valores de enum.

ALTER TABLE "Plan"
    ADD COLUMN IF NOT EXISTS "precioBaseCOP" double precision,
    ADD COLUMN IF NOT EXISTS "esFreemium" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "usosMaximosPorCliente" integer;

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_CREATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_UPDATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_TOGGLE';
