-- ============================================================
-- Monitor EN VIVO de simulaciones (se refresca cada 3s).
-- Uso (Ctrl+C para salir):
--   docker exec -i 002-2026-proteccion-infantil-db-1 \
--     psql -U proteccion -d proteccion_infantil < ~/Downloads/monitorear-simulacion.sql
-- ============================================================
SELECT
    sr.modelo,
    sr.estado,
    sr.progreso || '/' || sr."totalCasos"                       AS progreso,
    round(100.0 * sr.progreso / nullif(sr."totalCasos", 0), 0)  AS pct,
    count(c.id)                                                 AS clasificados_reales,
    round(avg(c."latenciaMs"))                                  AS latencia_ms
FROM simulacion_runs sr
LEFT JOIN simulacion_reportes srp ON srp."simulacionRunId" = sr.id
LEFT JOIN "ClasificacionIA"  c    ON c."reporteId"          = srp."reporteId"
GROUP BY sr.id, sr.modelo, sr.estado, sr.progreso, sr."totalCasos", sr."fechaInicio"
ORDER BY sr."fechaInicio" DESC
LIMIT 10
\watch 3
