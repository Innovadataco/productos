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
#   el del domingo queda como semanal. Retención: 14 diarios y 8 semanales; de los extras (con motivo), los de
#   las últimas 48 h y el más reciente de cada motivo nunca se borran, y de los demás quedan 10. Nunca se borra
#   el recién escrito ni uno cuyo .sha256 falte o no cuadre; si el cálculo falla, no se borra nada.
# - Un solo respaldo a la vez en el contenedor (el manual de `exec --ahora` y el del bucle): candado con
#   flock -n sobre $ESTADO_DIR/respaldo.candado (tmpfs del contenedor; se suelta solo si el proceso muere).
#   El manual espera hasta RESPALDO_ESPERA_S segundos (600 por defecto) y si no, sale con 75; el bucle no
#   espera: lo intenta otra vez al minuto siguiente. La marca de fallo y el .parcial llevan el PID, y si el
#   nombre final ya existe (dos respaldos en el mismo segundo) se toma el segundo siguiente: nunca se pisa.
# - Los .parcial de un respaldo cortado (contenedor detenido a mitad) se borran al pasar 60 minutos.
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
RETENER_EXTRAS=10
EXTRAS_INTOCABLES_S=172800 # 48 h: un extra más nuevo que esto nunca se borra por retención
REINTENTO_S=900
ESPERA_CANDADO_S="${RESPALDO_ESPERA_S:-600}"
OCUPADO=75
PARCIAL_VIEJO_MIN=60
INTENTOS_NOMBRE=5

hora_cot() { TZ=COT5 date "$@"; }
registrar() { printf '%s [respaldo] %s\n' "$(hora_cot '+%Y-%m-%d %H:%M COT')" "$*" >&2; }

# Nombre: fecha AAAAMMDD-HHMMSS ($1), día de la semana 1-7 ($2), motivo opcional ($3).
nombre_respaldo() {
  if [ -n "${3:-}" ]; then sufijo="-$3"; elif [ "$2" = "7" ]; then sufijo="-semanal"; else sufijo=""; fi
  printf 'inv-008-%s%s.dump.age\n' "$1" "$sufijo"
}

# Lee nombres por stdin e imprime los que sobran según la retención. $1 = ahora (AAAAMMDD-HHMMSS, COT);
# $2 = el respaldo recién escrito, que nunca se imprime (pero cuenta en su grupo).
# - Diarios y semanales: quedan los RETENER_DIARIOS y RETENER_SEMANALES más nuevos.
# - Extras (con motivo): nunca sobran los de las últimas 48 h (una fecha futura cuenta como reciente) ni el más
#   reciente de cada motivo; de los demás quedan los RETENER_EXTRAS más nuevos.
# Con «ahora» inválido no imprime nada y sale con 2. Una entrada incompleta (un grep o un sort cortados) solo
# puede borrar menos, nunca más: el puesto de cada uno baja, «el más reciente de su motivo» solo se gana y las
# 48 h no dependen del resto. Por eso no hace falta pipefail (que dash no tiene).
respaldos_a_borrar() {
  case "${1:-}" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]) ;;
    *) registrar "retención: la hora de referencia no es AAAAMMDD-HHMMSS"; return 2 ;;
  esac
  grep -E '^inv-008-[0-9]{8}-[0-9]{6}(-[a-z0-9-]+)?\.dump\.age$' | LC_ALL=C sort -r | awk \
    -v max_diarios="$RETENER_DIARIOS" -v max_semanales="$RETENER_SEMANALES" -v max_extras="$RETENER_EXTRAS" \
    -v ventana="$EXTRAS_INTOCABLES_S" -v ahora="$1" -v nuevo="${2:-}" '
      # Segundos de un AAAAMMDD-HHMMSS contados desde una fecha fija (días civiles, algoritmo de H. Hinnant):
      # solo sirve para restar dos. Sin mktime ni strftime, que no están en todos los awk.
      function segundos(t,   anio, mes, dia, era, anio_era, dia_anio, dia_era) {
        anio = substr(t, 1, 4) + 0; mes = substr(t, 5, 2) + 0; dia = substr(t, 7, 2) + 0
        if (mes <= 2) anio--
        era = int(anio / 400); anio_era = anio - era * 400
        dia_anio = int((153 * (mes > 2 ? mes - 3 : mes + 9) + 2) / 5) + dia - 1
        dia_era = anio_era * 365 + int(anio_era / 4) - int(anio_era / 100) + dia_anio
        return ((era * 146097 + dia_era) * 24 + substr(t, 10, 2)) * 3600 + substr(t, 12, 2) * 60 + substr(t, 14, 2)
      }
      BEGIN { corte = segundos(ahora) - ventana }
      {
        # Por posición (el grep ya filtró la forma): «inv-008-» (8) + AAAAMMDD-HHMMSS (15) + [-motivo] +
        # «.dump.age» (9). Un motivo como «x-semanal» es un extra, no un semanal.
        if (length($0) == 32) sobra = (++diarios > max_diarios)
        else if (substr($0, 24) == "-semanal.dump.age") sobra = (++semanales > max_semanales)
        else {
          motivo = substr($0, 25, length($0) - 33)
          primero = !(motivo in visto)
          visto[motivo] = 1
          if (primero || segundos(substr($0, 9, 15)) >= corte) next
          sobra = (++extras > max_extras)
        }
        if (sobra && $0 != nuevo) print
      }'
}

# Verdadero si el .sha256 de $1 (en DIR) existe, empieza con 64 hex y cuadra con el archivo.
sha256_cuadra() {
  [ -f "$DIR/$1.sha256" ] || return 1
  esperado="$(cut -d' ' -f1 <"$DIR/$1.sha256")" || return 1
  case "$esperado" in '' | *[!0-9a-f]*) return 1 ;; esac
  [ "${#esperado}" -eq 64 ] || return 1
  calculado="$(cd "$DIR" && sha256sum "$1")" || return 1
  [ "${calculado%% *}" = "$esperado" ]
}

# La retención después de un respaldo nuevo ($1, su nombre). En un subshell: no pisa las variables de respaldar.
# Primero calcula la lista completa; si algo falla (listar, la hora o el cálculo), no borra nada. Nunca borra el
# recién escrito ni un respaldo cuyo .sha256 falte o no cuadre (queda para revisarlo a mano, y sigue ocupando su
# puesto). Borra el .age y solo después su .sha256: si falla el primero, el par queda entero; si falla el segundo,
# queda un .sha256 suelto (sin respaldo) y se registra. Sale con 1 si algo no se pudo hacer.
retener() (
  set -f
  listado="$(ls -1 -- "$DIR")" || { registrar "retención: no se pudo listar la carpeta: no se borra nada"; exit 1; }
  ahora="$(hora_cot +%Y%m%d-%H%M%S)" || { registrar "retención: no se pudo leer la hora: no se borra nada"; exit 1; }
  sobran="$(printf '%s\n' "$listado" | respaldos_a_borrar "$ahora" "$1")" ||
    { registrar "retención: falló el cálculo: no se borra nada"; exit 1; }
  fallo=0
  for viejo in $sobran; do
    # Defensa en profundidad: respaldos_a_borrar ya filtra la forma y excluye el recién escrito.
    case "$viejo" in
      inv-008-*.dump.age) ;;
      *) registrar "retención: nombre inesperado, no se borra: $viejo"; fallo=1; continue ;;
    esac
    [ "$viejo" != "$1" ] || continue
    { [ -f "$DIR/$viejo" ] && [ ! -L "$DIR/$viejo" ]; } || continue
    if ! sha256_cuadra "$viejo"; then
      registrar "retención: no se borra $viejo: su .sha256 falta o no cuadra (revisarlo a mano)"
      continue
    fi
    if rm -f "$DIR/$viejo" && rm -f "$DIR/$viejo.sha256"; then
      registrar "retención: borrado $viejo"
    else
      registrar "retención: no se pudo borrar $viejo o su .sha256"
      fallo=1
    fi
  done
  exit "$fallo"
)

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
  case "$ESPERA_CANDADO_S" in '' | *[!0-9]*) registrar "RESPALDO_ESPERA_S debe ser un entero de segundos"; exit 64 ;; esac
}

# Borra los .parcial de más de PARCIAL_VIEJO_MIN minutos: los deja un respaldo cortado a mitad. Se llama con
# el candado tomado (ningún respaldo de este contenedor está escribiendo); el umbral es por prudencia.
limpiar_parciales() {
  find "$DIR" -maxdepth 1 -type f -name '.inv-008-*.parcial' -mmin +"$PARCIAL_VIEJO_MIN" | while IFS= read -r viejo; do
    rm -f "$viejo"
    registrar "borrado un .parcial huérfano: ${viejo##*/}"
  done
}

# Un respaldo con el candado tomado. $1 = motivo; $2 = segundos que espera si otro respaldo lo tiene.
# Sale con OCUPADO (75) si no lo consigue. El candado vive en el subshell: se suelta al terminar.
respaldar_con_candado() {
  (
    mkdir -p "$ESTADO_DIR"
    exec 7>"$ESTADO_DIR/respaldo.candado"
    espera="$2"
    until flock -n 7; do
      if [ "$espera" -le 0 ]; then
        registrar "otro respaldo está en curso: este no se hace"
        exit "$OCUPADO"
      fi
      espera=$((espera - 1))
      sleep 1
    done
    limpiar_parciales
    respaldar "$1"
  )
}

# Un respaldo (siempre por respaldar_con_candado). $1 = motivo opcional. Imprime la ruta del archivo nuevo.
respaldar() {
  motivo="${1:-}"
  umask 027
  mkdir -p "$ESTADO_DIR"
  intento=1
  while :; do
    nombre="$(nombre_respaldo "$(hora_cot +%Y%m%d-%H%M%S)" "$(hora_cot +%u)" "$motivo")"
    [ -e "$DIR/$nombre" ] || break
    if [ "$intento" -ge "$INTENTOS_NOMBRE" ]; then
      registrar "ya existe $nombre: no se sobrescribe un respaldo"
      return 1
    fi
    intento=$((intento + 1))
    sleep 1
  done
  final="$DIR/$nombre"
  parcial="$DIR/.$nombre.$$.parcial"
  fallo="$ESTADO_DIR/pg_dump.$$.fallo"
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
  # Cada paso con su error explícito: el bucle llama a esto en contexto condicional, donde `set -e` no
  # actúa. Si falla uno, no queda nada a medias (un respaldo sin .sha256 o sin el grupo no se cuenta).
  if ! mv -f "$parcial" "$final" ||
    ! (cd "$DIR" && sha256sum "$nombre" >"$nombre.sha256") ||
    { [ -n "$GID" ] && ! chgrp "$GID" "$final" "$final.sha256"; } ||
    ! chmod 0640 "$final" "$final.sha256"; then
    rm -f "$parcial" "$final" "$final.sha256"
    registrar "no se pudo dejar listo el respaldo (mover, sha256, grupo o permisos): no se guardó"
    return 1
  fi
  # El respaldo ya quedó bien: si la retención falla, se registra y el respaldo cuenta igual.
  retener "$nombre" || registrar "retención: no se completó (el respaldo nuevo quedó bien)"
  registrar "respaldo listo: $nombre"
  printf '%s\n' "$final"
}

# Una pasada del bucle: el diario, si toca. Con el candado tomado por otro respaldo (el manual de un
# despliegue), no espera ni lo cuenta como fallo: lo intenta en la pasada siguiente.
pasada() {
  ultimo="$(cat "$DIR/.ultimo-diario" 2>/dev/null || true)"
  toca_respaldo "$(hora_cot +%H%M)" "$(hora_cot +%Y%m%d)" "$ultimo" || return 0
  [ "$(date +%s)" -ge "$proximo_intento" ] || return 0
  codigo=0
  respaldar_con_candado "" 0 >/dev/null || codigo=$?
  case "$codigo" in
    0) hora_cot +%Y%m%d >"$DIR/.ultimo-diario" ;;
    "$OCUPADO") registrar "el diario se intenta en el próximo minuto" ;;
    *)
      proximo_intento=$(($(date +%s) + REINTENTO_S))
      registrar "se reintenta en $((REINTENTO_S / 60)) minutos"
      ;;
  esac
}

bucle() {
  registrar "arranca: un respaldo diario a las $HORA COT (el del domingo, semanal)"
  proximo_intento=0
  while :; do
    mkdir -p "$ESTADO_DIR"
    : >"$ESTADO_DIR/latido"
    pasada
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
      respaldar_con_candado "$motivo" "$ESPERA_CANDADO_S"
      ;;
    --salud) salud ;;
    "") preparar_conexion; bucle ;;
    *) echo "uso: respaldo.sh [--ahora [--motivo x] | --salud]" >&2; exit 64 ;;
  esac
}

[ "${RESPALDO_CARGAR_SOLO:-}" = 1 ] || principal "$@"
