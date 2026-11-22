-- Inversiones · roles de producción (idempotente). Lo corre crear-roles-prod.sh como superusuario,
-- conectado a la base de Inversiones. SQL puro: sin claves y sin metacomandos de psql (las claves las
-- fija el script después, por la entrada estándar). Las mismas sentencias las prueba el CI contra una
-- PostgreSQL 16 real (tests/unit/produccion/roles-base.test.ts).
--
--  inv_dueno: dueño de la base, del esquema y de todas las tablas. Solo lo usa el migrador (y los
--             comandos de carga y de acceso inicial, que corren en el contenedor del migrador).
--  inv_app:   la app. Por defecto solo LEE; las escrituras del login las da privilegios.sql, tabla por
--             tabla, después de cada migración. Nunca TRUNCATE (se salta los disparadores de fila) ni DDL.
-- inv_precios e inv_ia (los servicios de precios y de los resúmenes con IA) no van aquí: los crea crear-roles-prod.sh
-- (sql_rol_precios y sql_rol_ia), NOLOGIN hasta su secreto y sin privilegios por defecto; sus permisos, por columna,
-- los da docker/migrador/privilegios.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_dueno') THEN
    CREATE ROLE inv_dueno LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_app') THEN
    CREATE ROLE inv_app LOGIN;
  END IF;
END
$$;

ALTER ROLE inv_dueno WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 5;
ALTER ROLE inv_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 10;

-- La base es de inv_dueno; PUBLIC no se conecta. inv_app solo se conecta.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO inv_dueno', current_database());
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO inv_app', current_database());
END
$$;

-- El esquema public es de inv_dueno: nadie más crea objetos en él.
ALTER SCHEMA public OWNER TO inv_dueno;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO inv_app;

-- Lo que cree inv_dueno de aquí en adelante: inv_app solo lee las tablas y usa las secuencias.
ALTER DEFAULT PRIVILEGES FOR ROLE inv_dueno IN SCHEMA public GRANT SELECT ON TABLES TO inv_app;
ALTER DEFAULT PRIVILEGES FOR ROLE inv_dueno IN SCHEMA public GRANT USAGE ON SEQUENCES TO inv_app;
-- Las funciones que cree inv_dueno no son ejecutables por PUBLIC (los disparadores no lo necesitan).
ALTER DEFAULT PRIVILEGES FOR ROLE inv_dueno REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
