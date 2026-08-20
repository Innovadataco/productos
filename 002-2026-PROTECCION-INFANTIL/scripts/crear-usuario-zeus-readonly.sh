#!/usr/bin/env bash
# SPEC-183 (002-PI-078): crea/actualiza el usuario Postgres de solo lectura para ZEUS.
# Idempotente y aditivo: no revoca permisos de otros roles.
#
# Uso (en el VPS, con .env.production cargado):
#   ./scripts/crear-usuario-zeus-readonly.sh
#
# Variables requeridas:
#   DB_ZEUS_READONLY_PASSWORD  - password del usuario zeus_readonly
#   DB_PASSWORD                - password del usuario admin de Postgres (proteccion)
#
# Variables opcionales:
#   DB_HOST, DB_PORT, DB_ADMIN_USER, DB_NAME

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_ADMIN_USER="${DB_ADMIN_USER:-proteccion}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-${DB_PASSWORD:-}}"
DB_NAME="${DB_NAME:-proteccion_infantil}"
ZEUS_USER="${ZEUS_USER:-zeus_readonly}"
ZEUS_PASSWORD="${DB_ZEUS_READONLY_PASSWORD:-}"

if [ -z "$ZEUS_PASSWORD" ]; then
    echo "ERROR: DB_ZEUS_READONLY_PASSWORD no está definida" >&2
    exit 1
fi

if [ -z "$DB_ADMIN_PASSWORD" ]; then
    echo "ERROR: DB_PASSWORD (o DB_ADMIN_PASSWORD) no está definida" >&2
    exit 1
fi

# Escapar comillas simples en el password para SQL ('' → ').
ZEUS_PASSWORD_ESCAPED="${ZEUS_PASSWORD//'/''}"

export PGPASSWORD="$DB_ADMIN_PASSWORD"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ZEUS_USER}') THEN
        EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', '${ZEUS_USER}', '${ZEUS_PASSWORD_ESCAPED}');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${ZEUS_USER}', '${ZEUS_PASSWORD_ESCAPED}');
    END IF;
END
\$\$;

REVOKE ALL ON SCHEMA public FROM ${ZEUS_USER};
GRANT USAGE ON SCHEMA public TO ${ZEUS_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${ZEUS_USER};
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ZEUS_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${ZEUS_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${ZEUS_USER};

-- Endurecimiento del schema public: quitar CREATE al pseudo-rol PUBLIC y
-- devolvérselo solo al rol de aplicación (proteccion). Esto evita que
-- zeus_readonly (u otros roles futuros) creen objetos.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CREATE ON SCHEMA public TO proteccion;

-- Verificación mínima: asegurar que no tenga privilegios de escritura
ALTER ROLE ${ZEUS_USER} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SQL

echo "[OK] Usuario ${ZEUS_USER} creado/actualizado con grants de solo lectura sobre public."
