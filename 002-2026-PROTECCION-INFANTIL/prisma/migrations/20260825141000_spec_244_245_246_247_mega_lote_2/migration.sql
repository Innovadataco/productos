-- SPEC-244/245/246/247 — Mega-lote 2 ACTIVACION-Y-COBROS
-- Migración 100% aditiva: tipos, columnas, constraint única y valores de enum.

-- Enums nuevos (idempotente vía DO blocks porque CREATE TYPE IF NOT EXISTS no existe para enums en PostgreSQL)
DO $$
BEGIN
    CREATE TYPE "OrigenSuscripcion" AS ENUM ('SOLICITADA_CLIENTE', 'ACTIVADA_MANUAL_ADMIN', 'FREEMIUM_AUTO', 'INVITACION_ADMIN');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "MetodoPagoManual" AS ENUM ('TRANSFERENCIA_BANCARIA', 'EFECTIVO', 'CHEQUE', 'OTRO');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "OrigenBono" AS ENUM ('PROMOCION_ADMIN', 'RECOMPENSA_PAGO');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Valores aditivos en enums existentes
ALTER TYPE "EstadoSuscripcion" ADD VALUE IF NOT EXISTS 'PENDIENTE_AUTORIZACION';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REPORTE_SIN_SUSCRIPCION';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_CREATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_UPDATE';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'PLAN_TOGGLE';

-- Extensión de Suscripcion (SPEC-244/245)
ALTER TABLE "Suscripcion"
    ADD COLUMN IF NOT EXISTS "origen" "OrigenSuscripcion" NOT NULL DEFAULT 'SOLICITADA_CLIENTE',
    ADD COLUMN IF NOT EXISTS "autorizadoPorAdminId" TEXT,
    ADD COLUMN IF NOT EXISTS "autorizadoEn" TIMESTAMPTZ(6),
    ADD COLUMN IF NOT EXISTS "metodoPagoManual" "MetodoPagoManual",
    ADD COLUMN IF NOT EXISTS "referenciaPagoManual" TEXT,
    ADD COLUMN IF NOT EXISTS "montoRealPagado" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "fechaPagoReal" TIMESTAMPTZ(6);

-- Extensión de BonoPromocional (SPEC-246)
ALTER TABLE "BonoPromocional"
    ADD COLUMN IF NOT EXISTS "origen" "OrigenBono" NOT NULL DEFAULT 'PROMOCION_ADMIN',
    ADD COLUMN IF NOT EXISTS "beneficiarioUsuarioId" TEXT,
    ADD COLUMN IF NOT EXISTS "transferible" BOOLEAN NOT NULL DEFAULT true;

-- Dedup de reglas de notificación antes de agregar constraint única (SPEC-247)
-- Mantiene la regla más reciente por (evento, canal, plantillaClave).
DELETE FROM "notificacion_reglas" a
USING (
    SELECT evento, canal, "plantillaClave", MAX("createdAt") AS max_created
    FROM "notificacion_reglas"
    GROUP BY evento, canal, "plantillaClave"
    HAVING COUNT(*) > 1
) b
WHERE a.evento = b.evento
  AND a.canal = b.canal
  AND a."plantillaClave" = b."plantillaClave"
  AND a."createdAt" < b.max_created;

-- Constraint única aditiva en NotificacionRegla (SPEC-247)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notificacion_reglas_evento_canal_plantillaClave_key'
          AND conrelid = '"notificacion_reglas"'::regclass
    ) THEN
        ALTER TABLE "notificacion_reglas"
            ADD CONSTRAINT "notificacion_reglas_evento_canal_plantillaClave_key"
            UNIQUE (evento, canal, "plantillaClave");
    END IF;
END $$;
