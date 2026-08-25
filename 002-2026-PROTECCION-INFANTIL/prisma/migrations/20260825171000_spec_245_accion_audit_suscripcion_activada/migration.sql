-- SPEC-245 (002-PI-148): valor aditivo en enum AccionAudit para activación/autorización
-- manual de suscripción por admin. 100% aditivo (ADD VALUE IF NOT EXISTS).
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'SUSCRIPCION_ACTIVADA_MANUAL';
