-- SPEC-344 (A-69 · C1 · FR-031): valor aditivo en el enum AccionAudit para
-- la reasignación del profesor a cargo de una materia (PATCH curso/materia).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_CURSO_MATERIA_ACTUALIZADA';
