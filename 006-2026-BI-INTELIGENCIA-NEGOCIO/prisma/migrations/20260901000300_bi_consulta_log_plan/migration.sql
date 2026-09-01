-- Aditiva: traza completa del motor (candado 12) — el plan del LLM
-- (índices, filtros y VALORES) queda en la bitácora para auditoría y
-- depuración (caso I-05: el valor exacto del filtro no era visible).
ALTER TABLE "bi_consulta_log" ADD COLUMN IF NOT EXISTS "planJson" TEXT;
