-- SPEC-176: acción de auditoría para reactivación de curso (antes se auditaba
-- como DESACTIVADO en ambos sentidos). ADITIVA: solo ALTER TYPE ADD VALUE.
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_CURSO_ACTIVADO';
