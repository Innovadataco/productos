-- SPEC-195 (002-PI-089): extiende AccionAudit con las acciones humanas de
-- resolución de spam. Migración aditiva pura (ALTER TYPE ADD VALUE IF NOT EXISTS).
-- IF NOT EXISTS por coordinación con SPEC-193 y SPEC-196 que también extienden el enum.

ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SPAM_CONFIRMADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SPAM_CORREGIDO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SPAM_PROCESADO_COMO_ACOSO';
