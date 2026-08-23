-- SPEC-234 (002-PI-134): nuevas acciones de auditoría para compilación de informes y generación de PDFs.
-- Migración aditiva: ALTER TYPE ADD VALUE.

ALTER TYPE "AccionAudit" ADD VALUE 'INFORME_CONSOLIDADO_CREADO';
ALTER TYPE "AccionAudit" ADD VALUE 'PDF_GENERADO';
