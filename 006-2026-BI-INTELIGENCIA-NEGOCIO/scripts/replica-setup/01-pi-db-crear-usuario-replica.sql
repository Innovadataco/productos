-- ==========================================================================
-- 01-pi-db-crear-usuario-replica.sql · Producto 006 · BI v2
-- Réplica read-only de PI vía pg_logical (publicación `bi_replica`).
--
-- DÓNDE CORRE: en el Postgres de PI (pi-db · PUBLICADOR). Lo ejecuta Jelkin
--   con autorización expresa. REGLA DURA: NUNCA correr DML/DDL contra las
--   tablas de PI — este script solo crea el rol de replicación (si falta) y
--   ajusta permisos de lectura. No toca datos.
--
-- ESTADO (verificado con CEO 2026-09-01): el rol `bi_replica` YA EXISTE en el
--   Postgres de PI (Fase A del 005 · 2026-08-28). Este script es IDEMPOTENTE:
--   si el rol existe NO toca su password; si no existe, lo crea.
--
-- SECRETOS (B3): el password llega por variable psql, nunca en este archivo:
--   psql -v ON_ERROR_STOP=1 -v bi_replica_password="$PI_REPLICA_PASSWORD" \
--        -f 01-pi-db-crear-usuario-replica.sql
--   El valor vive solo en el gestor de contraseñas IDC
--   (ver INVENTARIO-DE-SECRETOS.md del repo de gestión). NUNCA pegarlo en
--   chat, commits, specs ni docs.
--
-- Uso completo: ver INSTRUCTIVO-REPLICA-006.md · paso A-2.
-- ==========================================================================

-- Crear el rol de replicación SOLO si no existe (idempotente).
SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'bi_replica') AS rol_existe \gset

\if :rol_existe
  \echo '[01] Rol bi_replica ya existe — password intacto, no se recrea'
\else
  \if :{?bi_replica_password}
  \else
    \echo '[01] FALLO: el rol bi_replica no existe y falta -v bi_replica_password=... (B2: falla en voz alta)'
  \endif
  -- Si la variable falta, :'bi_replica_password' llega literal al servidor y
  -- el CREATE USER aborta con error de sintaxis (psql NO tiene \exit · con
  -- ON_ERROR_STOP=1 el script termina con código distinto de cero).
  CREATE USER bi_replica WITH REPLICATION ENCRYPTED PASSWORD :'bi_replica_password';
  \echo '[01] Rol bi_replica creado con atributo REPLICATION'
\endif

-- Permisos de lectura en el schema public (idempotentes por naturaleza).
GRANT USAGE ON SCHEMA public TO bi_replica;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bi_replica;

-- Garantizar SELECT en tablas FUTURAS del schema public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO bi_replica;

-- Defensa en profundidad (Ley 1581): el rol de réplica NO lee tablas con PII,
-- aunque la publicación ya las excluye. La publicación `bi_replica` jamás las
-- incluye (script 02 falla en voz alta si las detecta), pero si la credencial
-- se usara a mano tampoco debe poder leerlas.
-- Lista verificada en fuente (schema.prisma de PI, 2026-09-01): existe
-- "Usuario" (con passwordHash) y "TokenRecuperacion"; "Password" y "Session"
-- NO existen hoy — se revocan solo si existen (DO con guard de pg_class).
DO $$
DECLARE
  tabla_pii text;
  tablas_pii text[] := ARRAY['Usuario', 'Password', 'Session', 'TokenRecuperacion'];
BEGIN
  FOREACH tabla_pii IN ARRAY tablas_pii LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tabla_pii AND c.relkind = 'r'
    ) THEN
      EXECUTE format('REVOKE SELECT ON %I FROM bi_replica', tabla_pii);
      RAISE NOTICE '[01] SELECT revocado en tabla PII: %', tabla_pii;
    END IF;
  END LOOP;
END $$;

-- Verificación final.
SELECT usename, userepl FROM pg_user WHERE usename = 'bi_replica';
-- Esperado: bi_replica | t
