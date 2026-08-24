-- SPEC-223 (002-PI-124): valores de auditoría del digest semanal al CEO.
-- Migración aditiva segura: solo añade los valores que aún no existan en AccionAudit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'ANALISIS_DIGEST_GENERADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'ANALISIS_DIGEST_GENERADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'ANALISIS_DIGEST_ENVIADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'ANALISIS_DIGEST_ENVIADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'ANALISIS_DIGEST_FALLIDO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'ANALISIS_DIGEST_FALLIDO';
  END IF;
END $$;
