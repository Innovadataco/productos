#!/usr/bin/env bash
# Inversiones · crea o actualiza los roles inv_dueno e inv_app en la base de producción (idempotente).
#
# Uso (en el VPS, desde el clon, ANTES del primer despliegue y cada vez que se roten sus claves):
#   sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/crear-roles-prod.sh
#
# Las claves salen del único archivo de producción (/opt/inversiones-008/.env.inversiones.production,
# 600 de root): de INV_DUENO_DATABASE_URL e INV_APP_DATABASE_URL. Nunca de una migración (el repo es
# público). Llegan a psql SOLO por la entrada estándar: printf es interno de bash, así que no aparecen en
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

generar_entrada_psql() {
  printf '%s\n' '\set ON_ERROR_STOP on' '\set QUIET on' '\set VERBOSITY terse'
  printf '%s\n' "SET log_min_error_statement = 'panic';" "SET log_statement = 'none';"
  cat "$INV_DIR_008/scripts/crear-roles-prod.sql"
  printf "\\\\set clave_dueno '%s'\n" "$clave_dueno"
  printf "\\\\set clave_app '%s'\n" "$clave_app"
  printf '%s\n' "ALTER ROLE inv_dueno PASSWORD :'clave_dueno';" "ALTER ROLE inv_app PASSWORD :'clave_app';"
  printf '%s\n' '\unset clave_dueno' '\unset clave_app'
  printf '%s\n' "SELECT 'roles listos: ' || string_agg(rolname, ', ' ORDER BY rolname) FROM pg_roles WHERE rolname IN ('inv_dueno', 'inv_app');"
}

main() {
  [ $# -eq 0 ] || morir "no lleva argumentos"
  preparar_entorno
  armar_compose
  local url_dueno url_app
  url_dueno="$(leer_variable_env "$INV_ENV_PROD" INV_DUENO_DATABASE_URL)" || morir "falta INV_DUENO_DATABASE_URL en $INV_ENV_PROD"
  url_app="$(leer_variable_env "$INV_ENV_PROD" INV_APP_DATABASE_URL)" || morir "falta INV_APP_DATABASE_URL en $INV_ENV_PROD"
  clave_dueno="$(clave_de_url "$url_dueno" inv_dueno)"
  clave_app="$(clave_de_url "$url_app" inv_app)"
  [ "$clave_dueno" != "$clave_app" ] || morir "inv_dueno e inv_app deben tener claves distintas"
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado

  informar "levantando solo la base de $INV_PROYECTO_ACTIVO"
  "${COMPOSE[@]}" up -d --wait inv-008-db
  informar "creando o actualizando inv_dueno e inv_app (claves por stdin)"
  generar_entrada_psql | "${COMPOSE[@]}" exec -T inv-008-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d inversiones -tA
  informar "listo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
