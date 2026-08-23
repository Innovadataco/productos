-- SPEC-235 (002-PI-135): valores de auditoría para el ciclo de vida de guías de acción.
-- Migración aditiva segura: solo añade los valores que aún no existan en AccionAudit.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_CREADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_CREADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_EDITADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_EDITADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_ENVIADA_COMITE') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_ENVIADA_COMITE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_APROBADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_APROBADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_RECHAZADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_RECHAZADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_PUBLICADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_PUBLICADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'GUIA_ACCION_REEMPLAZADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'GUIA_ACCION_REEMPLAZADA';
  END IF;
END $$;
