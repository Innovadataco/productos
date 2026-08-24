-- SPEC-215 (002-PI-115): valores de auditoría del programa de referidos.
-- Migración aditiva segura: solo añade los valores que aún no existan en AccionAudit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REFERIDO_REGISTRADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REFERIDO_REGISTRADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'REFERIDO_RECOMPENSA_OTORGADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'REFERIDO_RECOMPENSA_OTORGADA';
  END IF;
END $$;
