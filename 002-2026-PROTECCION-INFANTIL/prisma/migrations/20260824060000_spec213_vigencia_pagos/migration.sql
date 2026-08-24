-- SPEC-213 (002-PI-113): motor de vigencia de pagos.
-- Migración aditiva: valor de auditoría para transiciones automáticas e índices
-- de consulta del worker sobre Suscripcion. Sin DROP ni cambios destructivos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'SUSCRIPCION_TRANSICION_AUTOMATICA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'SUSCRIPCION_TRANSICION_AUTOMATICA';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Suscripcion_estado_fechaFin_esFreemium_idx" ON "Suscripcion"("estado", "fechaFin", "esFreemium");
CREATE INDEX IF NOT EXISTS "Suscripcion_estado_fechaCorteProgramado_idx" ON "Suscripcion"("estado", "fechaCorteProgramado");
