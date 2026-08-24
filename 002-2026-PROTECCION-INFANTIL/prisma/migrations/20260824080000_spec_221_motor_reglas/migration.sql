-- SPEC-221 (002-PI-122): motor de reglas de recomendación.
-- Aditiva sobre lo dejado por SPEC-220 (20260824061000_analisis_modelo_score):
-- cadencia de evaluación por regla, índices de dedup/expiración y acción de
-- auditoría de resolución humana. Cero DROP, cero cambio de tipo.

-- Valor aditivo en enum existente
ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RECOMENDACION_RESUELTA';

-- Columna aditiva: última corrida del motor (gobierna frecuenciaMin)
ALTER TABLE "reglas_recomendacion" ADD COLUMN IF NOT EXISTS "ultimaEvaluacionEn" TIMESTAMPTZ(6);

-- Índices aditivos: dedup del motor por (regla, sujeto) en PENDIENTE + barrido de expiración
CREATE INDEX IF NOT EXISTS "recomendaciones_reglaId_sujetoId_estado_idx" ON "recomendaciones"("reglaId", "sujetoId", "estado");
CREATE INDEX IF NOT EXISTS "recomendaciones_expiraEn_idx" ON "recomendaciones"("expiraEn");
