-- ==========================================================================
-- 04-verificar-replica.sql · Producto 006 · BI v2
-- DÓNDE CORRE: en bi-db (suscriptor), DESPUÉS de 03-bi-db-replica-suscripcion.sql
--   y de darle tiempo a la copia inicial (~30 seg o más según volumen de PI).
--
-- Qué verifica:
--   * Estado de la suscripción bi006_replica_sub (apply worker + wal receiver).
--   * Progreso de la copia inicial tabla por tabla (pg_subscription_rel).
--   * TEST 7 · paridad master↔réplica (counts).
--   * TEST 8 · INSERT rechazado por bi_reader (REGLA DE ABORTO).
--
-- NOTA DE CORRECCIÓN vs 005 (corrección honesta): el script del 005 leía una
--   columna `status` de pg_stat_subscription que NO existe en esa vista. Lo
--   correcto en el suscriptor: pg_stat_subscription (apply worker) +
--   pg_stat_wal_receiver (status = streaming). Corregido aquí.
-- ==========================================================================

-- ─── Estado del apply worker de la suscripción (CRITERIO PRINCIPAL) ────────
SELECT
  subname,
  pid,
  received_lsn,
  latest_end_lsn,
  last_msg_receipt_time
FROM pg_stat_subscription
WHERE subname = 'bi006_replica_sub';
-- Esperado: 1 fila con pid NOT NULL = apply worker activo y recibiendo.
-- received_lsn debe AVANZAR al insertar filas en PI.

-- ─── Wal receiver (referencia; NO es criterio) ─────────────────────────────
SELECT
  status,
  sender_host,
  sender_port,
  slot_name
FROM pg_stat_wal_receiver;
-- NOTA (verificado en prueba en vivo 2026-09-01): en replicación LÓGICA esta
-- vista puede devolver 0 filas aunque la réplica funcione — el apply worker
-- no se reporta acá en PG16 (esa vista es de la réplica FÍSICA). El criterio
-- que manda es pg_stat_subscription (arriba) con pid NOT NULL y LSN avanzando.
-- Para el status=streaming del lado publicador ver el bloque opcional de abajo
-- (pg_stat_replication en PI).

-- ─── Progreso de la copia inicial por tabla ────────────────────────────────
-- srsubstate: i=inicial · d=copiando datos · s=sincronizada · r=lista (ready)
SELECT sr.srsubstate, count(*) AS tablas
FROM pg_subscription_rel sr
JOIN pg_subscription s ON s.oid = sr.srsubid
WHERE s.subname = 'bi006_replica_sub'
GROUP BY sr.srsubstate
ORDER BY sr.srsubstate;
-- Esperado al terminar la copia inicial: 23 tablas en 'r' (o 's').
-- Si hay tablas en 'i'/'d' la copia sigue en curso: esperar y repetir.

-- ─── (Opcional · corre en PI, publicador) slot + walsender ─────────────────
-- SELECT slot_name, active, wal_status,
--        pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS wal_retenido
-- FROM pg_replication_slots WHERE slot_name = 'bi006_replica_slot';
-- Esperado: active = t · wal_retenido pequeño (crece si la réplica está apagada
-- y drena al volver — ver REGLA DEL SLOT en INSTRUCTIVO-REPLICA-006.md).
--
-- SELECT application_name, state, sync_state FROM pg_stat_replication
-- WHERE application_name = 'bi006_replica_sub';
-- Esperado: state = streaming (acá SÍ vive el status, del lado publicador).

-- ─── TEST 7 · PARIDAD MASTER↔RÉPLICA ───────────────────────────────────────
-- Ejecutar primero en PI (master) los mismos counts, por ejemplo:
--   docker compose -f /opt/proteccion-infantil/docker-compose.prod.yml exec -T pi-db \
--     psql -U proteccion -d proteccion_infantil -c 'SELECT count(*) FROM "Reporte";'
--   (repetir con "Colegio" y "Subscription")
--
-- Luego en bi-db (este archivo):
SELECT count(*) AS replica_reporte FROM "Reporte";
SELECT count(*) AS replica_colegio FROM "Colegio";
SELECT count(*) AS replica_subscription FROM "Subscription";
-- Criterio: counts iguales a master, o réplica ≤ master con lag < 10 s.
-- Si la réplica acaba de sincronizar: esperar 30 s y repetir.

-- ─── TEST 8 · INSERT RECHAZADO POR bi_reader (REGLA DE ABORTO) ─────────────
-- Ejecutar con el usuario bi_reader (NO con el superusuario):
--   docker compose -f docker-compose.bi.yml exec -e PGPASSWORD="$BI_READER_PASSWORD" bi-db \
--     psql -U bi_reader -d "$REPLICA_DB_NAME" -c \
--     "INSERT INTO \"Colegio\" (id, nombre) VALUES ('test-bi-006', 'test');"
--
-- DEBE FALLAR con:
--   "ERROR: permission denied for table Colegio"
--
-- ⚠️ REGLA DE ABORTO: si la réplica ACEPTA el INSERT → PARA · avisar al CEO ·
-- NO se emite CUMPLE. La réplica de BI es read-only por diseño (aislamiento
-- de PI · constitución §0).

-- Pegar output literal de Test 7 y Test 8 en el cierre.md de la SPEC activa.
