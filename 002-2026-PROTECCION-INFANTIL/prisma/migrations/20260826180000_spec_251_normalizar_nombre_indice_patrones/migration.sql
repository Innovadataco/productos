-- SPEC-251 (002-PI-154 · I-49): normalizar nombre del índice único de patrones_institucionales.
--
-- La migración 20260802170000_f5_evento_match_f6_patrones crea el índice como
-- "patrones_institucionales_colegioId_periodo_grado_conducta__key" (62 chars, doble guión bajo).
-- Las BDs creadas antes de esa migración (o con una versión anterior de Prisma) tienen el
-- índice como "patrones_institucionales_colegioId_periodo_grado_conducta_p_key" (63 chars).
--
-- Esta migración es idempotente: renombra el índice __key → _p_key si existe (BDs creadas
-- por migrate deploy desde cero, e.g. CI), y es no-op si ya existe _p_key (producción/dev).
-- Después de esto, AMBOS entornos tienen "patrones_institucionales_colegioId_periodo_grado_conducta_p_key".

ALTER INDEX IF EXISTS "patrones_institucionales_colegioId_periodo_grado_conducta__key"
RENAME TO "patrones_institucionales_colegioId_periodo_grado_conducta_p_key";
