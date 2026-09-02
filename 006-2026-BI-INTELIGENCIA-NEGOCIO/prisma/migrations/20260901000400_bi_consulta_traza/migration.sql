-- Aditiva: observabilidad del chat (SPEC-006 · AGENTE A).
-- respuestaTexto: el texto final que vio el usuario (historial persistente).
-- pasosJson: auditoría paso a paso del pipeline NL→SQL (array JSON de
-- PasoTraza: { paso, detalle?, ms } con ms desde el inicio de la consulta).
ALTER TABLE "bi_consulta_log" ADD COLUMN IF NOT EXISTS "respuestaTexto" TEXT;
ALTER TABLE "bi_consulta_log" ADD COLUMN IF NOT EXISTS "pasosJson" TEXT;
