-- SPEC-211 (002-PI-111): vistas de cliente del módulo de pagos.
-- Migración aditiva: 2 valores del enum AccionAudit (renovación reportada y
-- cancelación por el cliente) + columna opcional `notasCliente` en Pago.
-- Sin DROP ni cambios destructivos. Idempotente (IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'PAGO_REPORTADO') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'PAGO_REPORTADO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'SUSCRIPCION_CANCELADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'SUSCRIPCION_CANCELADA';
  END IF;
END $$;

ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "notasCliente" TEXT;
