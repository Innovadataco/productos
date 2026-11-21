#!/bin/sh
# Inversiones · respaldo cifrado de la base (contenedor inv-008-respaldo, permanente, imagen inv-008-vigia).
#
#   pg_dump -Fc (rol inv_dueno, por la red interna) | age -r <pública> > /respaldos/<nombre>.dump.age
#
# - Sin texto plano en disco: el volcado va directo a age; si algo falla, no queda ningún archivo.
# - La clave de la base viaja por las variables de libpq (PGPASSWORD…), nunca en los argumentos de pg_dump.
# - Solo la clave PÚBLICA de age está en el VPS; la privada vive en el gestor de contraseñas de Jelk.
# - Archivos 0640, con el grupo RESPALDO_GID si se define (lectura para el usuario de la copia fuera del VPS).
# - Programación propia (sin systemd ni cron del host): un respaldo diario a RESPALDO_HORA (HHMM, COT);
#   el del domingo queda como semanal. Retención: 14 diarios, 8 semanales y 5 extras (con motivo).
#
# Uso: respaldo.sh                       (bucle)
#      respaldo.sh --ahora [--motivo x]   (un respaldo ya; imprime su ruta dentro del contenedor)
#      respaldo.sh --salud                (healthcheck: latido de menos de 3 minutos)
set -eu

DIR="${RESPALDO_DIR:-/respaldos}"
ESTADO_DIR="${RESPALDO_ESTADO_DIR:-/run/respaldo}"
HORA="${RESPALDO_HORA:-0230}"
GID="${RESPALDO_GID:-}"
RETENER_DIARIOS=14
RETENER_SEMANALES=8
RETENER_EXTRAS=5
REINTENTO_S=900

hora_cot() { TZ=COT5 date "$@"; }
registrar() { printf '%s [respaldo] %s\n' "$(hora_cot '+%Y-%m-%d %H:%M COT')" "$*" >&2; }

# Nombre: fecha AAAAMMDD-HHMMSS ($1), día de la semana 1-7 ($2), motivo opcional ($3).
nombre_respaldo() {
  if [ -n "${3:-}" ]; then sufijo="-$3"; elif [ "$2" = "7" ]; then sufijo="-semanal"; else sufijo=""; fi
  printf 'inv-008-%s%s.dump.age\n' "$1" "$sufijo"
}

# Lee nombres por stdin e imprime los que sobran según la retención (los más viejos de cada grupo).
respaldos_a_borrar() {
  grep -E '^inv-008-[0-9]{8}-[0-9]{6}(-[a-z0-9-]+)?\.dump\.age$' | sort -r | awk \
    -v d="$RETENER_DIARIOS" -v s="$RETENER_SEMANALES" -v e="$RETENER_EXTRAS" '
      /-semanal\.dump\.age$/ { if (++ns > s) print; next }
      /^inv-008-[0-9]{8}-[0-9]{6}\.dump\.age$/ { if (++nd > d) print; next }
      { if (++ne > e) print }'
}

# Verdadero si toca el respaldo diario: la hora actual ($1, HHMM) ya llegó a HORA y hoy ($2) no se hizo
# todavía (el último diario fue $3).
toca_respaldo() {
  [ "$1" -ge "$HORA" ] && [ "$2" != "${3:-}" ]
}

# Valida y pasa la URL a las variables de libpq. Solo acepta postgresql://usuario:clave@host:puerto/base.
preparar_conexion() {
  case "${DATABASE_URL:-}" in
    postgresql://*:*@*:*/*) ;;
    *) registrar "DATABASE_URL falta o no es postgresql://usuario:clave@host:puerto/base: no arranca"; exit 64 ;;
  esac
  resto="${DATABASE_URL#postgresql://}"
  credenciales="${resto%%@*}"
  servidor="${resto#*@}"
  hostpuerto="${servidor%%/*}"
  base="${servidor#*/}"
  PGUSER="${credenciales%%:*}"
  PGPASSWORD="${credenciales#*:}"
  PGHOST="${hostpuerto%%:*}"
  PGPORT="${hostpuerto##*:}"
  PGDATABASE="${base%%\?*}"
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
  printf '%s' "${AGE_PUBLICA:-}" | grep -Eq '^age1[0-9a-z]{58}$' || { registrar "AGE_PUBLICA no es una clave pública de age: no arranca"; exit 64; }
  case "$HORA" in [0-2][0-9][0-5][0-9]) ;; *) registrar "RESPALDO_HORA debe ser HHMM"; exit 64 ;; esac
}

# Un respaldo. $1 = motivo opcional. Imprime la ruta del archivo nuevo.
respaldar() {
  motivo="${1:-}"
  umask 027
  mkdir -p "$ESTADO_DIR"
  nombre="$(nombre_respaldo "$(hora_cot +%Y%m%d-%H%M%S)" "$(hora_cot +%u)" "$motivo")"
  final="$DIR/$nombre"
  parcial="$DIR/.$nombre.parcial"
  fallo="$ESTADO_DIR/pg_dump.fallo"
  rm -f "$fallo"
  if ! { pg_dump -Fc || : >"$fallo"; } | age -r "$AGE_PUBLICA" >"$parcial"; then
    rm -f "$parcial" "$fallo"
    registrar "falló el cifrado: no se guardó nada"
    return 1
  fi
  if [ -e "$fallo" ]; then
    rm -f "$parcial" "$fallo"
    registrar "falló pg_dump: no se guardó nada"
    return 1
  fi
  if [ "$(head -c 21 "$parcial")" != "age-encryption.org/v1" ]; then
    rm -f "$parcial"
    registrar "la salida no es un archivo de age: no se guardó"
    return 1
  fi
  mv -f "$parcial" "$final"
  (cd "$DIR" && sha256sum "$nombre" >"$nombre.sha256")
  [ -z "$GID" ] || chgrp "$GID" "$final" "$final.sha256"
  chmod 0640 "$final" "$final.sha256"
  ls -1 "$DIR" | respaldos_a_borrar | while IFS= read -r viejo; do
    rm -f "$DIR/$viejo" "$DIR/$viejo.sha256"
    registrar "retención: borrado $viejo"
  done
  registrar "respaldo listo: $nombre"
  printf '%s\n' "$final"
}

bucle() {
  registrar "arranca: un respaldo diario a las $HORA COT (el del domingo, semanal)"
  proximo_intento=0
  while :; do
    mkdir -p "$ESTADO_DIR"
    : >"$ESTADO_DIR/latido"
    ultimo="$(cat "$DIR/.ultimo-diario" 2>/dev/null || true)"
    if toca_respaldo "$(hora_cot +%H%M)" "$(hora_cot +%Y%m%d)" "$ultimo" && [ "$(date +%s)" -ge "$proximo_intento" ]; then
      if respaldar "" >/dev/null; then
        hora_cot +%Y%m%d >"$DIR/.ultimo-diario"
      else
        proximo_intento=$(($(date +%s) + REINTENTO_S))
        registrar "se reintenta en $((REINTENTO_S / 60)) minutos"
      fi
    fi
    sleep 60
  done
}

salud() {
  [ -n "$(find "$ESTADO_DIR/latido" -mmin -3 2>/dev/null)" ]
}

principal() {
  case "${1:-}" in
    --ahora)
      motivo=""
      if [ "${2:-}" = "--motivo" ]; then
        motivo="${3:-}"
        printf '%s' "$motivo" | grep -Eq '^[a-z0-9-]{1,32}$' || { registrar "motivo inválido (solo a-z, 0-9 y -)"; exit 64; }
        [ "$motivo" != "semanal" ] || { registrar "«semanal» es reservado"; exit 64; }
      fi
      preparar_conexion
      respaldar "$motivo"
      ;;
    --salud) salud ;;
    "") preparar_conexion; bucle ;;
    *) echo "uso: respaldo.sh [--ahora [--motivo x] | --salud]" >&2; exit 64 ;;
  esac
}

[ "${RESPALDO_CARGAR_SOLO:-}" = 1 ] || principal "$@"
