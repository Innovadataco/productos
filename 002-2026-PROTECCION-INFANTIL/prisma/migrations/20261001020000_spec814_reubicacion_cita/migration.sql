-- SPEC-814 · [NORMA] Ley 1581 art. 19 (reubicación / T7).
-- Estado REUBICADA (TERMINAL, NO es CANCELADA) para la cita original movida, + la prueba de la
-- continuidad DEMOSTRABLE que exige el art. 19, en SolicitudCita:
--   · reubicadaEnId   → la cita NUEVA (FK self, SetNull como las demás auto-referencias).
--   · reubicadaEn     → cuándo se reubicó.
--   · reubicadaPorId  → QUIÉN reubicó. TEXT DURABLE a propósito SIN FOREIGN KEY: es la prueba del
--     art. 19 y no puede borrarse con la cuenta del actor (un FK SetNull la vaciaría; uno Restrict
--     trabaría la baja de la cuenta). Asimetría: las cuentas se borran, las citas no.
-- Aditiva y no destructiva; no USA el valor nuevo en esta migración (pg16: ADD VALUE y su uso van
-- en transacciones separadas).

ALTER TYPE "EstadoSolicitudCita" ADD VALUE IF NOT EXISTS 'REUBICADA';

-- Rastro de auditoría del hecho (AuditLog SÍ replica a bi_replica; el QUIÉN consultable vive en
-- SolicitudCita.reubicadaPorId, que no replica).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_REUBICADA';

ALTER TABLE "SolicitudCita"
  ADD COLUMN "reubicadaEnId" TEXT,
  ADD COLUMN "reubicadaEn" TIMESTAMPTZ(6),
  ADD COLUMN "reubicadaPorId" TEXT;

ALTER TABLE "SolicitudCita"
  ADD CONSTRAINT "SolicitudCita_reubicadaEnId_fkey"
  FOREIGN KEY ("reubicadaEnId") REFERENCES "SolicitudCita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
