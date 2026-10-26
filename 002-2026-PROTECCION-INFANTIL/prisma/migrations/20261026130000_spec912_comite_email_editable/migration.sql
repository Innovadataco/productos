-- SPEC-912: la cuenta del Comité de Convivencia puede EDITARSE (cambiar el email del
-- registro). Aditiva: solo ADD VALUE al enum de auditoría; ningún cambio destructivo.

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'COLEGIO_COMITE_EMAIL_ACTUALIZADO';
