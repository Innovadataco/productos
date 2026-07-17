-- Verifica el estado de los reportes demo en la BD
-- Uso por SSH:
--   psql "postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil" -f verificar-demo.sql

\echo '=== Reportes demo por estado ==='
SELECT
    estado,
    COUNT(*) AS cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
FROM "Reporte"
WHERE "numeroSeguimiento" LIKE 'RPT-DEMO-%'
GROUP BY estado
ORDER BY cantidad DESC;

\echo '\n=== Total reportes demo ==='
SELECT COUNT(*) AS total_demo
FROM "Reporte"
WHERE "numeroSeguimiento" LIKE 'RPT-DEMO-%';

\echo '\n=== Reporte atascado en PROCESANDO (si existe) ==='
SELECT
    id,
    "numeroSeguimiento",
    identificador,
    ciudad,
    pais,
    LEFT(texto, 100) AS texto_preview,
    "actualizadoEn",
    EXTRACT(EPOCH FROM (NOW() - "actualizadoEn")) / 60 AS minutos_atascado
FROM "Reporte"
WHERE "numeroSeguimiento" LIKE 'RPT-DEMO-%'
  AND estado = 'PROCESANDO'
LIMIT 1;

\echo '\n=== Primeros 5 reportes pendientes ==='
SELECT
    id,
    "numeroSeguimiento",
    identificador,
    ciudad,
    pais,
    "creadoEn"
FROM "Reporte"
WHERE "numeroSeguimiento" LIKE 'RPT-DEMO-%'
  AND estado = 'PENDIENTE'
ORDER BY "creadoEn" ASC
LIMIT 5;

\echo '\n=== Procesos activos del generador de demo (desde pg_stat_activity) ==='
SELECT
    pid,
    usename,
    state,
    LEFT(query, 80) AS query_preview,
    EXTRACT(EPOCH FROM (NOW() - backend_start)) / 60 AS minutos_activo
FROM pg_stat_activity
WHERE query ILIKE '%Reporte%' OR query ILIKE '%generar-reportes%'
ORDER BY backend_start DESC
LIMIT 10;
