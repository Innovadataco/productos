-- SPEC-236 (002-PI-mega-cola): acciones de auditoría del motor de estados del
-- expediente padre + índice de barrido del worker (auto-cierre/SLA).
-- Aditiva: solo ADD VALUE e índice nuevo; ningún DROP ni cambio destructivo.

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_TRANSICION_ESTADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_RETENIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_SLA_VENCIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'EXPEDIENTE_GRAVEDAD_SUBIO_A_ROJO';

CREATE INDEX IF NOT EXISTS "Expediente_estado_ultimoEventoEn_idx" ON "Expediente"("estado", "ultimoEventoEn");
