-- SPEC-151: informe PDF mensual determinístico del colegio.
-- Añade un valor aditivo al enum "AccionAudit" para registrar la descarga.
-- Migración 100% aditiva. I-49: el diff crudo de `migrate diff` puede traer
-- DROP INDEX / RENAME de drift de objetos que viven solo en la BD real; esos
-- cambios NO se aplican aquí (mismo drift documentado en migraciones anteriores).

-- AlterEnum
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO';
