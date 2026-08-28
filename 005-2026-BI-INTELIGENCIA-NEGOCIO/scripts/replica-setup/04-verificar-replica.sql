-- 04-verificar-replica.sql
-- Ejecutar en bi-db-replica después de CREATE SUBSCRIPTION · Jelkin · Fase C
-- Verifica estado de replicación y prepara los Tests 7 y 8

-- Estado de la suscripción (debe mostrar status=streaming)
SELECT
  subname,
  pid,
  received_lsn,
  latest_end_lsn,
  status
FROM pg_stat_subscription
WHERE subname = 'bi_replica_sub';
-- Esperado: 1 fila · status = streaming

-- ─── TEST 7 · PARIDAD MASTER↔RÉPLICA ──────────────────────────────────────────
-- Ejecutar primero en pi-db (master):
--   psql -h pi-db -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
--   psql -h pi-db -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Colegio";'
--   psql -h pi-db -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Subscription";'
--
-- Luego ejecutar en bi-db-replica (este archivo):
SELECT count(*) AS replica_reporte FROM "Reporte";
SELECT count(*) AS replica_colegio FROM "Colegio";
SELECT count(*) AS replica_subscription FROM "Subscription";
-- Criterio: counts iguales a master o réplica ≤ master con lag < 10s
-- (Si réplica acaba de sincronizar · esperar 30s y repetir)

-- ─── TEST 8 · INSERT RECHAZADO POR bi_reader (REGLA DE ABORTO) ────────────────
-- Ejecutar con el usuario bi_reader (no bi_replica):
--   psql -h localhost -p 5433 -U bi_reader -d proteccion_infantil -c \
--     "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test', 'test');"
--
-- DEBE FALLAR con:
--   "ERROR: cannot execute INSERT in a read-only transaction"
--   o "ERROR: permission denied for table Colegio"
--
-- ⚠️ REGLA DE ABORTO: si la réplica ACEPTA el INSERT → PARA · avisa CEO · NO se emite CUMPLE

-- Pegar output literal de Test 7 y Test 8 en cierre.md de SPEC-002
