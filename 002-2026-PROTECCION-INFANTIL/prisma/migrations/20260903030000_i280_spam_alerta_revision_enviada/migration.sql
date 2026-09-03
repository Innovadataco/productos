-- I-280 (SPEC-387): valor del enum AccionAudit que usa el candado de repetición
-- del job de SLA de spam. Antes el job enviaba en cada vuelta y en 24 h había
-- 14× correos por caso.
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SPAM_ALERTA_REVISION_ENVIADA';
