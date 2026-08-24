-- SPEC-227 (002-PI-128): acción de auditoría para el export CSV del historial
-- de recomendaciones (FR-008). Aditiva: ADD VALUE IF NOT EXISTS, cero DROP.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RECOMENDACIONES_EXPORT_CSV';
