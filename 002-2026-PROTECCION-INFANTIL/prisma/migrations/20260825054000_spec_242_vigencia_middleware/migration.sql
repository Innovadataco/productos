-- SPEC-242 (002-PI-145): middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA
-- Migración 100% aditiva: solo agrega valores a enums.

ALTER TYPE "EstadoSuscripcion" ADD VALUE IF NOT EXISTS 'PENDIENTE_AUTORIZACION';
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'REPORTE_SIN_SUSCRIPCION';
