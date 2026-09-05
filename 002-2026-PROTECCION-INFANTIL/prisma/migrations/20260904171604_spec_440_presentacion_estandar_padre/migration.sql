-- SPEC-440 P5 (Jelkin vivo 04-09) · Presentación y urgencia estándar del padre.
--
-- El flujo /dashboard/padre/profesionales pide una presentación cada vez que
-- el padre entra. Ahora se guarda al enviar y se prellena la próxima. La caché
-- rápida sigue en sessionStorage (borrador-consulta.ts, SPEC-440 P1); esta es
-- la persistencia duradera.
--
-- Aditiva, `IF NOT EXISTS`, sin backfill. Los valores permitidos para
-- `urgenciaEstandar` se validan app-side ("ESTA_SEMANA" | "SIN_APURO") — no
-- creamos enum nuevo para no atascar `bi_replica` (memoria vigente 04-09).

ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "presentacionEstandar" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "urgenciaEstandar" TEXT;
