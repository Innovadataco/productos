-- SPEC-140 (F2/N-4) + SPEC-141 (N-1): valores ADITIVOS del enum AccionAudit.
-- Solo ADD VALUE (nunca recrear el tipo ni eliminar valores).
-- SPEC-140: eventos de denuncia formal y exportación forense (sin contenido).
ALTER TYPE "AccionAudit" ADD VALUE 'DENUNCIA_FORMAL_GENERADA';
ALTER TYPE "AccionAudit" ADD VALUE 'EXPEDIENTE_FORENSE_EXPORTADO';
-- SPEC-141: acceso de soporte admin (solo lectura) a círculo de confianza y roster.
ALTER TYPE "AccionAudit" ADD VALUE 'CIRCULO_CONFIANZA_ACCESO_ADMIN';
ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_ROSTER_ACCESO_ADMIN';
