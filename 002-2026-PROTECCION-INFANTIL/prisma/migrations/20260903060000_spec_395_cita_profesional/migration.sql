-- SPEC-395 (L4 · veredicto CEO 09:50): la cita profesional.
-- Migración aditiva: NADA existente cambia constraint. Todo lo nuevo es NULL
-- por default o ADD VALUE IF NOT EXISTS.

-- 1) Columna aditiva en SolicitudCita para el reloj de 48h del profesional.
--    `pagoAprobadoEn` es el momento en que el admin activó el pago manual
--    (endpoint hermano de /admin/pagos/activar-manual). El worker calcula
--    `pagoAprobadoEn + 48h` en tiempo real; antes de que el admin apruebe,
--    la solicitud está SIN_CONFIRMAR y `venceEn` es el plazo del PADRE
--    para completar el pago (si vence sin pagar, la franja se libera).
ALTER TABLE "SolicitudCita" ADD COLUMN "pagoAprobadoEn" TIMESTAMPTZ(6);

-- 2) Valores de AccionAudit para la cita profesional. Todo en la MISMA
--    migración que el código (lección I-277: si el enum llega después que
--    el código que lo usa, hay una ventana con `main` roto).
--    CITA_PROFESIONAL_AVISO_48H_ENVIADO es el candado de repetición del
--    worker (patrón I-280 SPAM_ALERTA_REVISION_ENVIADA).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_PAGO_APROBADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_PAGO_EXPIRADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_AVISO_48H_ENVIADO';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_CONFIRMADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_RECHAZADA_PROFESIONAL';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_REPROGRAMADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_REASIGNADA';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_VENCIDA_PROFESIONAL';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_ALARMA_TASA_VENCIMIENTOS';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'CITA_PROFESIONAL_SUSPENDIDO_POR_VENCIMIENTOS';
