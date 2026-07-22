-- ============================================================
-- Purga de datos de SIMULACIÓN (reutilizable). SOLO entornos dev.
-- Borra: runs de simulación, sus reportes (y clasificaciones/embeddings
-- por cascada) y limpia la cola pg-boss. No toca reportes reales/seed.
-- Uso:
--   docker exec -i 002-2026-proteccion-infantil-db-1 \
--     psql -U proteccion -d proteccion_infantil < ~/Downloads/purgar-simulaciones.sql
-- ============================================================
BEGIN;

CREATE TEMP TABLE _sim_rep ON COMMIT DROP AS
  SELECT "reporteId" FROM simulacion_reportes;

DELETE FROM simulacion_reportes;
DELETE FROM simulacion_runs;
DELETE FROM "AlertaColegio" WHERE "reporteId" IN (SELECT "reporteId" FROM _sim_rep);
DELETE FROM "Reporte"       WHERE id          IN (SELECT "reporteId" FROM _sim_rep);
DELETE FROM pgboss.job WHERE name IN ('reporte-procesamiento', 'simulacion-run');

COMMIT;

\echo '== Restantes tras la purga =='
SELECT 'simulacion_runs'      AS tabla, count(*) FROM simulacion_runs
UNION ALL SELECT 'simulacion_reportes',  count(*) FROM simulacion_reportes
UNION ALL SELECT 'jobs reporte-proc.',   count(*) FROM pgboss.job WHERE name = 'reporte-procesamiento'
UNION ALL SELECT 'reportes PENDIENTE',   count(*) FROM "Reporte" WHERE estado = 'PENDIENTE';
