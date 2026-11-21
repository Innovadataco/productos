#!/usr/bin/env bash
# Inversiones · crea o actualiza los roles inv_dueno, inv_app e inv_precios en la base de producción (idempotente).
#
# Uso (en el VPS, desde el clon, ANTES del primer despliegue y cada vez que se roten sus claves):
#   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh   (<raíz>: ver ESTADO en la gestión)
#
# Las claves salen del único archivo de producción (<raíz>/.env.inversiones.production,
# 600 de root): de INV_DUENO_DATABASE_URL e INV_APP_DATABASE_URL (y de INV_PRECIOS_DATABASE_URL, si está). Nunca de
# una migración (el repo es público). Llegan a psql SOLO por la entrada estándar: printf es interno de bash, así que
# no aparecen en los argumentos de ningún proceso (`ps`). Antes de fijarlas se apaga el registro de sentencias con
# error, para que una clave nunca termine en el log de PostgreSQL.
#
# inv_precios (el servicio de precios) existe SIEMPRE desde la primera corrida (decisión del CEO): así los GRANT de
# inv_precios que traiga un respaldo encuentran el rol en la restauración (pg_restore --exit-on-error, produccion.md §6).
#  - sin la línea INV_PRECIOS_DATABASE_URL en el archivo, queda NOLOGIN y sin clave, también si ya tenía LOGIN: quitar
#    la línea lo desactiva (las conexiones abiertas siguen hasta que se cierren);
#  - con la línea, recibe LOGIN y su clave en una sola sentencia;
#  - con la línea vacía, mal formada o con la clave de otro rol, aborta sin tocar Docker (ni rota las otras claves).
# Sus privilegios de tablas no salen de aquí: los da el migrador (privilegios.sql) en el siguiente despliegue; hasta
# entonces no lee nada.
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
# Nace NOLOGIN; el LOGIN no se toca aquí (lo decide el secreto, más abajo), así no hay vaivén en un rol que ya entra.
# Solo CONNECT a la base y USAGE del esquema; sin privilegios por defecto: cada permiso de tabla, por columna,
# lo da privilegios.sql (que lo corre el migrador como inv_dueno). 4 conexiones: dos veces el pool de su URL
# (connection_limit=2); con inv_dueno (5) e inv_app (10) suman 19 de las 30 de la base. Lo prueba el CI contra una PostgreSQL 16 real
# (tests/unit/produccion/roles-base.test.ts).
sql_rol_precios() {
  cat <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios') THEN
    CREATE ROLE inv_precios NOLOGIN;
  END IF;
END
$$;
ALTER ROLE inv_precios WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 4;
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO inv_precios', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO inv_precios;
SQL
}

# Sin el secreto: sin LOGIN y sin clave (también si los tenía).
sql_precios_sin_login() {
  printf '%s\n' "ALTER ROLE inv_precios WITH NOLOGIN PASSWORD NULL;"
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
  sql_rol_precios
  if [ -n "$clave_precios" ]; then
    printf "\\\\set clave_precios '%s'\n" "$clave_precios"
    printf '%s\n' "ALTER ROLE inv_precios WITH LOGIN PASSWORD :'clave_precios';" '\unset clave_precios'
  else
    sql_precios_sin_login
  fi
  printf '%s\n' "SELECT 'roles listos: ' || string_agg(rolname || CASE WHEN NOT rolcanlogin THEN ' (sin LOGIN)' ELSE '' END, ', ' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('inv_dueno', 'inv_app', 'inv_precios');"
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
  # inv_precios: sin la línea queda NOLOGIN y sin clave; con la línea, se valida como las otras (vacía o mal formada, aborta).
  local url_precios
  clave_precios=""
  if url_precios="$(leer_variable_env "$INV_ENV_PROD" INV_PRECIOS_DATABASE_URL)"; then
    clave_precios="$(clave_de_url "$url_precios" inv_precios)"
    [ "$clave_precios" != "$clave_dueno" ] && [ "$clave_precios" != "$clave_app" ] ||
      morir "inv_precios debe tener una clave distinta de las de inv_dueno e inv_app"
  else
    informar "⚠️  sin INV_PRECIOS_DATABASE_URL en el archivo de producción: inv_precios queda sin LOGIN y sin clave (el rol existe igual, para los respaldos). El servicio de precios la necesita (produccion.md §2)"
  fi
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado

  informar "levantando solo la base de $INV_PROYECTO_ACTIVO"
  "${COMPOSE[@]}" up -d --wait inv-008-db
  local precios="sin LOGIN"
  [ -z "$clave_precios" ] || precios="con su clave"
  informar "creando o actualizando inv_dueno, inv_app e inv_precios ($precios; claves por stdin)"
  generar_entrada_psql | "${COMPOSE[@]}" exec -T inv-008-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d inversiones -tA
  informar "listo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
