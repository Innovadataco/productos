-- SPEC-225 (002-PI-126): detección de anomalías dinero-vs-valor.
-- Migración aditiva segura: el modelo Anomalia ya lo creó SPEC-220
-- (20260824061000_analisis_modelo_score); aquí solo se añade el índice de
-- deduplicación por anomalía abierta y el valor de auditoría. Cero DROP.

-- La columna real es camelCase (Prisma no la mapea a snake_case; la creó SPEC-220).
CREATE INDEX IF NOT EXISTS "anomalias_resueltaEn_idx" ON "anomalias"("resueltaEn");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'ANOMALIA_RESUELTA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'ANOMALIA_RESUELTA';
  END IF;
END $$;
