-- SPEC-325 (extensión · 002-PI-225): estado activo/inactivo del hijo, para que el
-- padre pueda activar/inactivar un hijo (patrón Profesor/Estudiante · A-58).
-- Aditiva: columna con default 'activo'; las filas existentes quedan activas.

ALTER TABLE "Hijo" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'activo';

CREATE INDEX IF NOT EXISTS "Hijo_estado_idx" ON "Hijo"("estado");
