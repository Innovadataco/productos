-- ============================================================
-- Revisión de resultados de simulación de modelos
-- Uso:
--   docker exec -i 002-2026-proteccion-infantil-db-1 \
--     psql -U proteccion -d proteccion_infantil < ~/Downloads/revisar-resultados-modelos.sql
-- ============================================================

\echo '== 1. RUNS DE SIMULACIÓN =='
SELECT id, modelo, "totalCasos", estado,
       "fechaInicio"::timestamp(0), "fechaFin"::timestamp(0)
FROM simulacion_runs
ORDER BY "fechaInicio" DESC;

\echo ''
\echo '== 2. ACCURACY Y LATENCIA POR MODELO (solo casos con categoriaEsperada) =='
SELECT sr.modelo,
       count(*)                                                                         AS casos,
       count(*) FILTER (WHERE srp."categoriaEsperada" = c.categoria::text)              AS aciertos,
       round(100.0 * count(*) FILTER (WHERE srp."categoriaEsperada" = c.categoria::text)
             / nullif(count(*),0), 1)                                                   AS accuracy_pct,
       round(avg(c.confianza)::numeric, 3)                                              AS confianza_prom,
       round(avg(c."latenciaMs"))                                                       AS latencia_ms_prom,
       count(*) FILTER (WHERE c."usoCascada")                                           AS uso_desempate
FROM simulacion_runs sr
JOIN simulacion_reportes srp ON srp."simulacionRunId" = sr.id
JOIN "ClasificacionIA"  c    ON c."reporteId"         = srp."reporteId"
WHERE srp."categoriaEsperada" IS NOT NULL
GROUP BY sr.modelo
ORDER BY accuracy_pct DESC;

\echo ''
\echo '== 3. ERROR SILENCIOSO (incorrecto pero clasificado con confianza alta >= 0.8) =='
SELECT sr.modelo,
       count(*) FILTER (WHERE srp."categoriaEsperada" <> c.categoria::text
                          AND c.confianza >= 0.8)                                        AS errores_silenciosos,
       count(*) FILTER (WHERE srp."categoriaEsperada" <> c.categoria::text)             AS errores_totales
FROM simulacion_runs sr
JOIN simulacion_reportes srp ON srp."simulacionRunId" = sr.id
JOIN "ClasificacionIA"  c    ON c."reporteId"         = srp."reporteId"
WHERE srp."categoriaEsperada" IS NOT NULL
GROUP BY sr.modelo;

\echo ''
\echo '== 4. MATRIZ DE CONFUSIÓN (esperado -> predicho, solo errores) =='
SELECT srp."categoriaEsperada" AS esperado, c.categoria AS predicho, count(*) AS n
FROM simulacion_reportes srp
JOIN "ClasificacionIA" c ON c."reporteId" = srp."reporteId"
WHERE srp."categoriaEsperada" IS NOT NULL
  AND srp."categoriaEsperada" <> c.categoria::text
GROUP BY 1, 2
ORDER BY n DESC;

\echo ''
\echo '== 5. DETALLE POR CASO (última run) =='
SELECT srp.indice,
       srp."categoriaEsperada" AS esperado,
       c.categoria             AS predicho,
       round(c.confianza::numeric, 2) AS conf,
       c."latenciaMs" AS ms,
       (srp."categoriaEsperada" = c.categoria::text) AS acierto
FROM simulacion_reportes srp
JOIN "ClasificacionIA" c ON c."reporteId" = srp."reporteId"
WHERE srp."simulacionRunId" = (SELECT id FROM simulacion_runs ORDER BY "fechaInicio" DESC LIMIT 1)
ORDER BY srp.indice;
