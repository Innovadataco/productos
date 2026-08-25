-- SPEC-248 (002-PI-151): cierra la brecha de la Ley 2564 de 2026 art. 6 en el
-- motor de clasificación IA (agrega CIBERACOSO/HAPPY_SLAPPING/STALKING) y habilita
-- la trazabilidad de auditoría para la edición de definiciones legales por ADMIN.
-- Migración 100% aditiva: solo ALTER TYPE ... ADD VALUE IF NOT EXISTS.
-- Cero DROP, cero CREATE TYPE nuevo, cero pérdida de datos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CategoriaConducta' AND e.enumlabel = 'CIBERACOSO') THEN
    ALTER TYPE "CategoriaConducta" ADD VALUE 'CIBERACOSO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CategoriaConducta' AND e.enumlabel = 'HAPPY_SLAPPING') THEN
    ALTER TYPE "CategoriaConducta" ADD VALUE 'HAPPY_SLAPPING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'CategoriaConducta' AND e.enumlabel = 'STALKING') THEN
    ALTER TYPE "CategoriaConducta" ADD VALUE 'STALKING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'RUBRICA_DEFINICION_UPDATE') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'RUBRICA_DEFINICION_UPDATE';
  END IF;
END $$;
