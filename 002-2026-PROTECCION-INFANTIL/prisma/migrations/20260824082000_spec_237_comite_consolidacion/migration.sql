-- SPEC-237 (002-PI-mega-cola): bandeja comité CONSOLIDACION + aprobación
-- multi-miembro. Aditiva: solo ADD VALUE, ADD COLUMN e índice nuevo; cero DROP.

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'INFORME_CONSOLIDADO_APROBADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'INFORME_CONSOLIDADO_CORREGIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'INFORME_CONSOLIDADO_DEVUELTO';

ALTER TABLE "informes_consolidados" ADD COLUMN IF NOT EXISTS "motivoDevolucion" TEXT;

CREATE INDEX IF NOT EXISTS "informes_consolidados_estadoAprobacion_idx" ON "informes_consolidados"("estadoAprobacion");
