-- ==========================================================================
-- 03-bi-db-replica-suscripcion.sql · Producto 006 · BI v2
-- Lado SUSCRIPTOR: corre en bi-db, el Postgres PROPIO del 006 (mismo servidor
-- que guarda las tablas propias bi_catalogo_*/bi_consulta_log/
-- bi_cache_semantico y que recibe la réplica read-only de PI vía pg_logical).
--
-- PRE-REQUISITOS (ver INSTRUCTIVO-REPLICA-006.md):
--   * Pasos A-1..A-3 completos en PI (rol + publicación bi_replica).
--   * bi-db corriendo y healthy (docker compose ... ps bi-db).
--   * Paso B-2 aplicado: schema de PI volcado en bi-db (pg_logical replica
--     DATOS, no SCHEMA — sin ese paso la suscripción falla).
--   * Ejecutar como el superusuario de arranque de bi-db (CREATE SUBSCRIPTION
--     exige superuser).
--
-- QUÉ HACE (todo idempotente):
--   1. Pre-flight B2: exige que el schema replicado ya exista en bi-db.
--   2. Rol bi_admin  → DATABASE_URL de la app/prisma (migraciones + runtime).
--   3. Rol bi_reader → analítica de SOLO LECTURA (motor NL→SQL, Fase 2).
--   4. Suscripción bi006_replica_sub → publicación bi_replica en PI
--      (slot de replicación NUEVO: bi006_replica_slot · el slot del 005 ya
--      fue eliminado — se parte de cero, decisión CEO 2026-09-01).
--
-- SECRETOS (B3): NADA de valores en este archivo. Las contraseñas y el
--   conninfo llegan por variables psql (sus valores solo en el gestor IDC):
--     -v bi006_admin_password="$BI_ADMIN_DB_PASSWORD"   (solo si falta el rol)
--     -v bi006_reader_password="$BI_READER_PASSWORD"    (solo si falta el rol)
--     -v bi006_conninfo="host=$PI_DB_HOST port=5432 dbname=$PI_DB_NAME \
--                        user=$PI_REPLICA_USER password=$PI_REPLICA_PASSWORD"
--   NUNCA pegar valores reales en chat, commits, specs ni docs
--   (ver INVENTARIO-DE-SECRETOS.md del repo de gestión).
--
-- NOTA TÉCNICA psql: psql NO tiene meta-comando \exit (eso es MySQL). Cuando
--   una variable -v requerida falta, el script imprime el FALLO con \echo y la
--   sentencia siguiente aborta con error de sintaxis — con ON_ERROR_STOP=1 el
--   script termina con código distinto de cero (falla en voz alta, B2).
--
-- Uso completo: INSTRUCTIVO-REPLICA-006.md · paso B-3.
-- ==========================================================================

-- ─── 1. Pre-flight B2: el schema replicado de PI DEBE existir ya en bi-db ───
-- pg_logical copia DATOS sobre tablas preexistentes. Sin el paso B-2 la
-- suscripción aborta con 'relation ... does not exist'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'Reporte' AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION '[03] FALLO: la tabla "Reporte" no existe en bi-db — corre primero el paso B-2 del INSTRUCTIVO-REPLICA-006.md (volcado de schema de PI)';
  END IF;
  RAISE NOTICE '[03] Pre-flight OK: schema replicado de PI presente en bi-db';
END $$;

-- ─── 2. Rol bi_admin (app/prisma · DATABASE_URL) · solo si falta ───────────
SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'bi_admin') AS admin_existe \gset

\if :admin_existe
  \echo '[03] Rol bi_admin ya existe — password intacto, no se recrea'
\else
  \if :{?bi006_admin_password}
  \else
    \echo '[03] FALLO: falta -v bi006_admin_password=... para crear bi_admin (B2)'
  \endif
  CREATE USER bi_admin WITH ENCRYPTED PASSWORD :'bi006_admin_password';
  \echo '[03] Rol bi_admin creado'
\endif

-- bi_admin: DDL en schema public (sus migraciones) + lectura de TODO lo
-- replicado. Las tablas bi_* que crea quedan de su propiedad (CRUD completo).
GRANT pg_read_all_data TO bi_admin;
GRANT USAGE, CREATE ON SCHEMA public TO bi_admin;

-- ─── 3. Rol bi_reader (solo lectura · motor NL→SQL Fase 2) · solo si falta ──
SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'bi_reader') AS reader_existe \gset

\if :reader_existe
  \echo '[03] Rol bi_reader ya existe — password intacto, no se recrea'
\else
  \if :{?bi006_reader_password}
  \else
    \echo '[03] FALLO: falta -v bi006_reader_password=... para crear bi_reader (B2)'
  \endif
  CREATE USER bi_reader WITH ENCRYPTED PASSWORD :'bi006_reader_password';
  \echo '[03] Rol bi_reader creado'
\endif

-- bi_reader NO tiene permisos de escritura — el Test 8 (script 04) lo verifica.
-- pg_read_all_data es rol nativo de Postgres 14+ · otorga SELECT en todo.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO bi_reader', current_database());
END $$;
GRANT pg_read_all_data TO bi_reader;

-- ─── 4. Suscripción a la publicación bi_replica de PI · solo si falta ───────
-- El slot bi006_replica_slot se crea en PI en este momento (create_slot=true).
-- REGLA DEL SLOT (4e): si algún día se retira la réplica DE FORMA PERMANENTE,
-- hay que hacer DROP SUBSCRIPTION (o pg_drop_replication_slot en PI) — un slot
-- huérfano retiene WAL hasta llenar el disco y TUMBAR PI. Apagar un rato no
-- pasa nada. Ver INSTRUCTIVO-REPLICA-006.md § Regla del slot.
SELECT EXISTS(SELECT 1 FROM pg_subscription WHERE subname = 'bi006_replica_sub') AS sub_existe \gset

\if :sub_existe
  \echo '[03] Suscripción bi006_replica_sub ya existe — no se recrea (idempotente)'
\else
  \if :{?bi006_conninfo}
  \else
    \echo '[03] FALLO: falta -v bi006_conninfo=... para crear la suscripción (B2)'
  \endif
  CREATE SUBSCRIPTION bi006_replica_sub
    CONNECTION :'bi006_conninfo'
    PUBLICATION bi_replica
    WITH (slot_name = 'bi006_replica_slot', create_slot = true, enabled = true, copy_data = true);
  \echo '[03] Suscripción bi006_replica_sub creada — sincronización inicial en curso (copy_data)'
\endif

-- ─── Verificación ──────────────────────────────────────────────────────────
SELECT subname, subenabled, subslotname FROM pg_subscription WHERE subname = 'bi006_replica_sub';
-- Esperado: bi006_replica_sub | t | bi006_replica_slot
-- La copia inicial tarda según el volumen de PI · verificar con 04-verificar-replica.sql
