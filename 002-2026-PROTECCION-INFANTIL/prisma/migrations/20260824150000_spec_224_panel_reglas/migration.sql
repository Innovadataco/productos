-- SPEC-224 (002-PI-125): panel de reglas configurables (Análisis dinero-vs-valor).
-- Migración aditiva segura: columna `version` en reglas, tabla de historial de
-- versiones y 7 valores de auditoría REGLA_*. Cero DROP, cero cambio de tipo.

-- 1. Columna aditiva de versionado en la tabla de reglas (creada por SPEC-220).
ALTER TABLE "reglas_recomendacion" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- 2. Tabla de historial de versiones (snapshot completo del estado anterior).
CREATE TABLE IF NOT EXISTS "regla_recomendacion_historial" (
    "id" TEXT NOT NULL,
    "reglaId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "motivo" TEXT NOT NULL,
    "cambiadoPorAdminId" TEXT NOT NULL,
    "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regla_recomendacion_historial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "regla_recomendacion_historial_reglaId_version_key"
    ON "regla_recomendacion_historial"("reglaId", "version");

CREATE INDEX IF NOT EXISTS "regla_recomendacion_historial_reglaId_creadoEn_idx"
    ON "regla_recomendacion_historial"("reglaId", "creadoEn" DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'regla_recomendacion_historial_reglaId_fkey'
    ) THEN
        ALTER TABLE "regla_recomendacion_historial"
            ADD CONSTRAINT "regla_recomendacion_historial_reglaId_fkey"
            FOREIGN KEY ("reglaId") REFERENCES "reglas_recomendacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'regla_recomendacion_historial_cambiadoPorAdminId_fkey'
    ) THEN
        ALTER TABLE "regla_recomendacion_historial"
            ADD CONSTRAINT "regla_recomendacion_historial_cambiadoPorAdminId_fkey"
            FOREIGN KEY ("cambiadoPorAdminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Valores aditivos del enum AccionAudit (ciclo de vida de reglas + test SQL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_CREADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_CREADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_ACTUALIZADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_ACTUALIZADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_ACTIVADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_ACTIVADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_DESACTIVADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_DESACTIVADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_PROMOVIDA_EJECUTA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_PROMOVIDA_EJECUTA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_REVERTIDA_RECOMIENDA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_REVERTIDA_RECOMIENDA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REGLA_SQL_TEST') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REGLA_SQL_TEST';
  END IF;
END $$;
