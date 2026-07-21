-- Agrega valor al enum AccionAudit para auditoría de descarga de PDF de estadísticas de colegio
-- Migración aditiva, no destructiva
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ESTADISTICAS_PDF_DESCARGADO';
