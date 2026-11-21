#!/usr/bin/env bash
# Inversiones · crea o actualiza los roles inv_dueno e inv_app (y inv_precios, si el archivo trae su URL) en la base
# de producción (idempotente).
#
# Uso (en el VPS, desde el clon, ANTES del primer despliegue y cada vez que se roten sus claves):
#   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh   (<raíz>: ver ESTADO en la gestión)
#
# Las claves salen del único archivo de producción (<raíz>/.env.inversiones.production,
# 600 de root): de INV_DUENO_DATABASE_URL e INV_APP_DATABASE_URL. Nunca de una migración (el repo es
# público).
# inv_precios (el servicio de precios) es opcional: sin la línea INV_PRECIOS_DATABASE_URL en el archivo se omite y
# se avisa (no se crea, ni se le cambia la clave si ya existía); con la línea presente pero vacía o mal formada,
# aborta sin tocar Docker. Sus privilegios de tablas no salen de aquí: los da el migrador (privilegios.sql) en el
# siguiente despliegue; hasta entonces se conecta y no lee nada. Llegan a psql SOLO por la entrada estándar: printf es interno de bash, así que no aparecen en
# los argumentos de ningún proceso (`ps`). Antes de fijarlas se apaga el registro de sentencias con error,
# para que una clave nunca termine en el log de PostgreSQL.
set -euo pipefail
INV_SCRIPT=crear-roles-prod
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

# Clave de una URL postgresql://<usuario>:<clave>@inv-008-db:5432/inversiones[?...], validada:
# el usuario esperado, el host y la base de Inversiones, y 32 o más caracteres sin reservar (hex o
# base64url): así no hace falta codificarla en la URL y no hay comillas que escapar en psql.
clave_de_url() {
  local url="$1" usuario="$2"
  local patron='^postgresql://([a-z_]+):([A-Za-z0-9._~-]+)@inv-008-db:5432/inversiones(\?.*)?$'
  [[ "$url" =~ $patron ]] || morir "la URL de $usuario no tiene la forma postgresql://$usuario:<clave>@inv-008-db:5432/inversiones (clave solo con letras, números y . _ ~ -)"
  [ "${BASH_REMATCH[1]}" = "$usuario" ] || morir "la URL de $usuario trae otro usuario"
  [ "${#BASH_REMATCH[2]}" -ge 32 ] || morir "la clave de $usuario debe tener 32 caracteres o más"
  printf '%s' "${BASH_REMATCH[2]}"
}

# SQL puro del rol inv_precios (sin clave ni metacomandos de psql), en un heredoc entre comillas: no se expande nada.
# Solo LOGIN, CONNECT a la base y USAGE del esquema; sin privilegios por defecto: cada permiso de tabla, por columna,
# lo da privilegios.sql (que lo corre el migrador como inv_dueno). Lo prueba el CI contra una PostgreSQL 16 real
# (tests/unit/produccion/roles-base.test.ts).
sql_rol_precios() {
  cat <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios') THEN
    CREATE ROLE inv_precios LOGIN;
  END IF;
END
$$;
ALTER ROLE inv_precios WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 3;
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO inv_precios', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO inv_precios;
SQL
}

generar_entrada_psql() {
  printf '%s\n' '\set ON_ERROR_STOP on' '\set QUIET on' '\set VERBOSITY terse'
  printf '%s\n' "SET log_min_error_statement = 'panic';" "SET log_statement = 'none';"
  cat "$INV_DIR_008/scripts/crear-roles-prod.sql"
  printf "\\\\set clave_dueno '%s'\n" "$clave_dueno"
  printf "\\\\set clave_app '%s'\n" "$clave_app"
  printf '%s\n' "ALTER ROLE inv_dueno PASSWORD :'clave_dueno';" "ALTER ROLE inv_app PASSWORD :'clave_app';"
  printf '%s\n' '\unset clave_dueno' '\unset clave_app'
  # inv_precios va después: si su bloque fallara, las claves de los otros dos ya quedaron fijadas.
  if [ -n "$clave_precios" ]; then
    sql_rol_precios
    printf "\\\\set clave_precios '%s'\n" "$clave_precios"
    printf '%s\n' "ALTER ROLE inv_precios PASSWORD :'clave_precios';" '\unset clave_precios'
  fi
  printf '%s\n' "SELECT 'roles listos: ' || string_agg(rolname, ', ' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('inv_dueno', 'inv_app', 'inv_precios');"
}

main() {
  [ $# -eq 0 ] || morir "no lleva argumentos"
  preparar_entorno
  revisar_arbol
  # Solo levanta la base: no necesita la carpeta de respaldos (sirve también en una restauración).
  armar_compose --sin-respaldos
  local url_dueno url_app
  url_dueno="$(leer_variable_env "$INV_ENV_PROD" INV_DUENO_DATABASE_URL)" || morir "falta INV_DUENO_DATABASE_URL en $INV_ENV_PROD"
  url_app="$(leer_variable_env "$INV_ENV_PROD" INV_APP_DATABASE_URL)" || morir "falta INV_APP_DATABASE_URL en $INV_ENV_PROD"
  clave_dueno="$(clave_de_url "$url_dueno" inv_dueno)"
  clave_app="$(clave_de_url "$url_app" inv_app)"
  [ "$clave_dueno" != "$clave_app" ] || morir "inv_dueno e inv_app deben tener claves distintas"
  # inv_precios: sin la línea se omite; con la línea, se valida como las otras (vacía o mal formada, aborta).
  local url_precios
  clave_precios=""
  if url_precios="$(leer_variable_env "$INV_ENV_PROD" INV_PRECIOS_DATABASE_URL)"; then
    clave_precios="$(clave_de_url "$url_precios" inv_precios)"
    [ "$clave_precios" != "$clave_dueno" ] && [ "$clave_precios" != "$clave_app" ] ||
      morir "inv_precios debe tener una clave distinta de las de inv_dueno e inv_app"
  else
    informar "⚠️  sin INV_PRECIOS_DATABASE_URL en el archivo de producción: se omite inv_precios (ni se crea ni se le cambia la clave). El servicio de precios la necesita (produccion.md §2)"
  fi
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado

  informar "levantando solo la base de $INV_PROYECTO_ACTIVO"
  "${COMPOSE[@]}" up -d --wait inv-008-db
  local roles="inv_dueno e inv_app"
  [ -z "$clave_precios" ] || roles="inv_dueno, inv_app e inv_precios"
  informar "creando o actualizando $roles (claves por stdin)"
  generar_entrada_psql | "${COMPOSE[@]}" exec -T inv-008-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d inversiones -tA
  informar "listo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
