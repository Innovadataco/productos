-- SPEC-217 (002-PI-117): freemium 30 días del módulo de pagos.
-- Migración aditiva: valores de auditoría de activación/conversión de freemium
-- e índices de consulta sobre Suscripcion (corte por el worker de vigencia y
-- verificación de histórico por titular). Sin DROP ni cambios destructivos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'SUSCRIPCION_FREEMIUM_ACTIVADA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'SUSCRIPCION_FREEMIUM_ACTIVADA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AccionAudit' AND e.enumlabel = 'SUSCRIPCION_FREEMIUM_CONVERTIDA') THEN
    ALTER TYPE "AccionAudit" ADD VALUE 'SUSCRIPCION_FREEMIUM_CONVERTIDA';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Suscripcion_esFreemium_freemiumFechaFin_idx" ON "Suscripcion"("esFreemium", "freemiumFechaFin");
CREATE INDEX IF NOT EXISTS "Suscripcion_usuarioId_esFreemium_idx" ON "Suscripcion"("usuarioId", "esFreemium");
CREATE INDEX IF NOT EXISTS "Suscripcion_colegioId_esFreemium_idx" ON "Suscripcion"("colegioId", "esFreemium");
