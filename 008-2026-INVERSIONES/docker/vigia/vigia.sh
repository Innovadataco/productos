#!/bin/sh
# Inversiones · vigía de convivencia con PI (contenedor inv-008-vigia, imagen mínima inv-008-vigia).
# SOLO AVISA por Telegram: nunca detiene, reinicia ni toca nada. El corte es manual (el aviso trae el comando).
#
# Lee, sin el socket de Docker y en solo lectura:
#  - la memoria del VPS: /host/meminfo (bind de /proc/meminfo);
#  - la huella `intradia` del servicio de precios (/precios-estado, el volumen inv-008-precios-estado en solo lectura): si el
#    ciclo de precios cada minuto quedó detenido hasta mañana (estado=LIMITADO con limitados >= 4: Yahoo bloqueó 4 veces
#    seguidas), avisa una vez y avisa una vez cuando vuelve;
#  - los OOM: el oom_kill JERÁRQUICO de /host/cgroup/system.slice/memory.events (driver systemd) o
#    /host/cgroup/docker/memory.events (cgroupfs). Persiste aunque el scope del contenedor muerto se borre.
#    Para identificar el contenedor mira además cada docker-<id>.scope: si su contador bajó, se recreó.
#
# Máquina de estados, sin spam:
#   OK → ALERTA (avisa una vez: memoria bajo el umbral u OOM nuevo)
#   ALERTA → PEOR (vuelve a avisar solo si MemAvailable baja VIGIA_PEOR_MIB más o hay otro OOM nuevo)
#   ALERTA → RESUELTO (avisa una vez) solo con MemAvailable ≥ umbral + VIGIA_PEOR_MIB durante
#            VIGIA_PASADAS_OK pasadas seguidas y sin OOM en los últimos VIGIA_OOM_CALMA_S segundos.
# El estado vive en tmpfs (/run/vigia): un reinicio del contenedor puede repetir una alerta, y está bien.
# El token va a curl por la entrada estándar (-K -): nunca en sus argumentos, que se ven en `ps`.
#
# Uso: vigia.sh            (bucle cada VIGIA_INTERVALO_S)
#      vigia.sh --una-pasada
#      vigia.sh --salud     (healthcheck: el latido tiene menos de 3 intervalos)
set -eu

MEMINFO="${VIGIA_MEMINFO:-/host/meminfo}"
CGROUP="${VIGIA_CGROUP:-/host/cgroup}"
ESTADO_DIR="${VIGIA_ESTADO_DIR:-/run/vigia}"
PRECIOS_DIR="${VIGIA_PRECIOS_ESTADO_DIR:-/precios-estado}"
# Tantos bloqueos seguidos de Yahoo y el servicio detiene el ciclo hasta mañana (MAX_LIMITADOS_SEGUIDOS de intradia.ts).
LIMITE_INTRADIA=4
UMBRAL_MIB="${VIGIA_UMBRAL_MEMAVAILABLE_MIB:-1024}"
PEOR_MIB="${VIGIA_PEOR_MIB:-256}"
PASADAS_OK="${VIGIA_PASADAS_OK:-3}"
OOM_CALMA_S="${VIGIA_OOM_CALMA_S:-900}"
INTERVALO_S="${VIGIA_INTERVALO_S:-60}"
API="${TELEGRAM_API:-https://api.telegram.org}"
# El comando de corte: la ruta de pausar-008.sh la pasan los scripts (derivada del clon). Si falta o no es una
# ruta absoluta de caracteres [A-Za-z0-9_./-], el aviso lleva el marcador: la ruta real no va en el repo.
RUTA_PAUSA="${VIGIA_RUTA_PAUSA:-}"
case "$RUTA_PAUSA" in
  /*[!A-Za-z0-9_./-]* | *..*) RUTA_PAUSA="" ;;
  /*) ;;
  *) RUTA_PAUSA="" ;;
esac
if [ -n "$RUTA_PAUSA" ]; then
  CORTE="ssh pi-vps sudo $RUTA_PAUSA"
else
  CORTE="ssh pi-vps sudo <raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh (<raíz>: ver ESTADO en la gestión)"
fi

# Hora de Colombia (UTC-5, sin horario de verano) sin depender de tzdata.
hora_cot() { TZ=COT5 date '+%Y-%m-%d %H:%M COT'; }
registrar() { printf '%s [vigia] %s\n' "$(hora_cot)" "$*" >&2; }
entero() { case "${1:-}" in '' | *[!0-9]*) return 1 ;; esac; }
leer_kb() { awk -v c="$1:" '$1 == c { print $2; exit }' "$MEMINFO" 2>/dev/null; }
escapar_json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

validar() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || { registrar "falta TELEGRAM_BOT_TOKEN: no arranca"; exit 64; }
  case "${TELEGRAM_BOT_TOKEN}" in *[!A-Za-z0-9:_-]*) registrar "TELEGRAM_BOT_TOKEN con caracteres no válidos: no arranca"; exit 64 ;; esac
  case "${TELEGRAM_CHAT_ID:-}" in
    '' | *[!0-9-]*) registrar "TELEGRAM_CHAT_ID falta o no es numérico: no arranca"; exit 64 ;;
  esac
  for n in "$UMBRAL_MIB" "$PEOR_MIB" "$PASADAS_OK" "$OOM_CALMA_S" "$INTERVALO_S"; do
    entero "$n" || { registrar "umbral, margen, pasadas, calma e intervalo deben ser enteros"; exit 64; }
  done
}

# oom_kill jerárquico: system.slice (driver systemd, el del VPS) o docker (cgroupfs, el de Colima).
# Sin ninguno de los dos, falla (código 1): el vigía NUNCA vuelve en silencio a sumar los scopes, porque
# un scope borrado tras un OOM se llevaría su contador.
oom_jerarquico() {
  total=0 hay=0
  for archivo in "$CGROUP/system.slice/memory.events" "$CGROUP/docker/memory.events"; do
    [ -r "$archivo" ] || continue
    n="$(awk '$1 == "oom_kill" { print $2; exit }' "$archivo")"
    entero "$n" || continue
    total=$((total + n)) hay=1
  done
  [ "$hay" = 1 ] || return 1
  echo "$total"
}

# Sin contador jerárquico: avisa UNA vez («vigía sin contador OOM»), deja el healthcheck en rojo y sale con
# error en cada pasada hasta que el contador vuelva.
sin_contador() {
  : >"$ESTADO_DIR/sin-contador"
  if [ ! -e "$ESTADO_DIR/sin-contador.avisado" ]; then
    texto="$(printf '🛑 Inversiones · vigía sin contador OOM\\nHora: %s\\nNo existe %s/system.slice/memory.events (ni docker/memory.events): el vigía no puede ver los OOM y su healthcheck queda en rojo. Revise el montaje de /sys/fs/cgroup.\\nEl vigía no actúa: solo avisa.' "$(hora_cot)" "$CGROUP")"
    if enviar "$texto"; then : >"$ESTADO_DIR/sin-contador.avisado"; fi
  fi
  registrar "SIN CONTADOR OOM: no existe el memory.events jerárquico en $CGROUP; healthcheck en rojo"
  return 1
}

# Escribe en $1 «id oom_kill» de cada contenedor (docker-<id>.scope o docker/<id>), ordenado.
contar_scopes() {
  find "$CGROUP" -maxdepth 4 -name memory.events 2>/dev/null |
    while IFS= read -r archivo; do
      dir="$(basename "$(dirname "$archivo")")"
      padre="$(basename "$(dirname "$(dirname "$archivo")")")"
      case "$dir" in
        docker-*.scope) id="${dir#docker-}"; id="${id%.scope}" ;;
        *) [ "$padre" = "docker" ] || continue; id="$dir" ;;
      esac
      case "$id" in *[!0-9a-f]* | '') continue ;; esac
      [ "${#id}" -eq 64 ] || continue
      printf '%s %s\n' "$id" "$(awk '$1 == "oom_kill" { print $2; exit }' "$archivo")"
    done | sort >"$1"
}

# Contenedores a identificar en un OOM: los que subieron («subió») y los recreados («recreado»: su contador
# bajó, porque el OOM mató el proceso principal y el scope volvió en 0). Imprime «id12 qué antes ahora».
contenedores_con_oom() {
  [ -f "$ESTADO_DIR/oom.scopes" ] || return 0
  awk 'NR == FNR { b[$1] = $2; next }
       ($1 in b) && ($2 + 0 > b[$1] + 0) { printf "%s subió %s %s\n", substr($1, 1, 12), b[$1], $2 }
       ($1 in b) && ($2 + 0 < b[$1] + 0) { printf "%s recreado %s %s\n", substr($1, 1, 12), b[$1], $2 }
       !($1 in b) && ($2 + 0 > 0)        { printf "%s subió 0 %s\n", substr($1, 1, 12), $2 }' \
    "$ESTADO_DIR/oom.scopes" "$1"
}

armar_mensaje() {
  tipo="$1" disponible="$2" swap="$3" oom_antes="$4" oom_ahora="$5" ooms="$6"
  case "$tipo" in
    ALERTA) titulo="⚠️ ALERTA" ;;
    PEOR) titulo="🔴 PEOR" ;;
    RESUELTO) titulo="✅ RESUELTO" ;;
  esac
  printf '%s · Inversiones, vigía del VPS compartido con PI\\n' "$titulo"
  printf 'Hora: %s\\n' "$(hora_cot)"
  printf 'MemAvailable: %s MiB (umbral de %s MiB) · SwapFree: %s MiB\\n' "$disponible" "$UMBRAL_MIB" "$swap"
  if [ "$oom_ahora" -gt "$oom_antes" ]; then
    printf 'OOM nuevo: oom_kill de los contenedores %s→%s.\\n' "$oom_antes" "$oom_ahora"
    if [ -n "$ooms" ]; then
      printf '%s\n' "$ooms" | while read -r id que antes ahora; do
        if [ "$que" = "recreado" ]; then
          printf 'Contenedor %s recreado (reinició tras el OOM). Identificarlo: docker ps --no-trunc | grep %s\\n' "$id" "$id"
        else
          printf 'Contenedor %s (oom_kill %s→%s). Identificarlo: docker ps --no-trunc | grep %s\\n' "$id" "$antes" "$ahora" "$id"
        fi
      done
    else
      printf 'El contenedor ya no existe (su cgroup se borró).\\n'
    fi
  fi
  if [ "$tipo" = "RESUELTO" ]; then
    printf 'La memoria lleva %s pasadas sobre el umbral más %s MiB y no hay OOM recientes.\\n' "$PASADAS_OK" "$PEOR_MIB"
  else
    printf 'Corte manual de Inversiones, si corresponde: %s\\n' "$(escapar_json "$CORTE")"
  fi
  printf 'El vigía no actúa: solo avisa.'
}

# Envía el mensaje: el JSON va en un archivo del tmpfs y la URL con el token, por stdin (-K -).
enviar() {
  printf '{"chat_id":"%s","text":"%s","disable_web_page_preview":true}' "$TELEGRAM_CHAT_ID" "$1" >"$ESTADO_DIR/mensaje.json"
  printf 'url = "%s/bot%s/sendMessage"\n' "$API" "$TELEGRAM_BOT_TOKEN" |
    curl -sS -f -m 15 -K - -H 'Content-Type: application/json' --data-binary "@$ESTADO_DIR/mensaje.json" -o /dev/null 2>/dev/null
}

# Precios cada minuto detenidos por Yahoo: lee la huella `intradia` (clave=valor) que escribe el servicio de precios. Avisa UNA vez
# al llegar a LIMITE_INTRADIA bloqueos seguidos y UNA vez cuando el estado deja de ser LIMITADO. Sin huella (tmpfs vacío), una
# huella dañada o un envío fallido: no cambia nada y se reintenta en la próxima pasada. Nunca actúa.
revisar_intradia() {
  archivo="$PRECIOS_DIR/intradia"
  bandera="$ESTADO_DIR/intradia.avisado"
  [ -r "$archivo" ] || return 0
  estado_i="$(awk -F= '$1 == "estado" { print $2; exit }' "$archivo")"
  limitados_i="$(awk -F= '$1 == "limitados" { print $2; exit }' "$archivo")"
  case "$estado_i" in '' | *[!A-Z_]*) return 0 ;; esac
  if [ "$estado_i" = "LIMITADO" ]; then
    entero "$limitados_i" || return 0
    [ "$limitados_i" -ge "$LIMITE_INTRADIA" ] || return 0
    [ ! -e "$bandera" ] || return 0
    texto="$(printf '🛑 Inversiones · precios cada minuto detenidos hasta mañana\\nHora: %s\\nHubo %s bloqueos seguidos de Yahoo (429/403/red): el ciclo no vuelve a pedir hoy. Insistir puede bloquear la IP del VPS compartido con PI y afectar también los cierres diarios.\\nPara apagarlos: INV_INTRADIA_ENCENDIDO=0 en el env de producción y redesplegar.\\nEl vigía no actúa: solo avisa.' "$(hora_cot)" "$limitados_i")"
    if enviar "$texto"; then : >"$bandera"; registrar "aviso de precios cada minuto detenidos enviado ($limitados_i bloqueos seguidos)"; else registrar "no se pudo enviar el aviso de precios cada minuto detenidos; se reintenta en la próxima pasada"; fi
    return 0
  fi
  [ -e "$bandera" ] || return 0
  texto="$(printf '✅ RESUELTO · Inversiones · precios cada minuto\\nHora: %s\\nEl ciclo de precios cada minuto volvió (estado %s).\\nEl vigía no actúa: solo avisa.' "$(hora_cot)" "$estado_i")"
  if enviar "$texto"; then rm -f "$bandera"; registrar "aviso de precios cada minuto resuelto enviado"; else registrar "no se pudo enviar el RESUELTO de precios cada minuto; se reintenta en la próxima pasada"; fi
}

guardar_estado() { printf '%s %s %s %s\n' "$1" "$2" "$3" "$4" >"$ESTADO_DIR/estado"; }

pasada() {
  mkdir -p "$ESTADO_DIR"
  : >"$ESTADO_DIR/latido"
  revisar_intradia || true
  disponible_kb="$(leer_kb MemAvailable)"
  swap_kb="$(leer_kb SwapFree)"
  if ! entero "$disponible_kb" || ! entero "$swap_kb"; then
    registrar "no se pudo leer MemAvailable o SwapFree de $MEMINFO"
    return 1
  fi
  disponible=$((disponible_kb / 1024)) swap=$((swap_kb / 1024)) ahora="$(date +%s)"

  contar_scopes "$ESTADO_DIR/oom.scopes.actual"
  oom_ahora="$(oom_jerarquico)" || { sin_contador; return 1; }
  rm -f "$ESTADO_DIR/sin-contador" "$ESTADO_DIR/sin-contador.avisado"
  primera=0
  if [ -f "$ESTADO_DIR/oom.total" ]; then oom_antes="$(cat "$ESTADO_DIR/oom.total")"; else oom_antes="$oom_ahora" primera=1; fi
  # Un contador más bajo (reinicio del VPS o del cgroup) no es un OOM: se toma como nueva línea base.
  [ "$oom_ahora" -ge "$oom_antes" ] || oom_antes="$oom_ahora"
  oom_nuevo=0
  [ "$primera" = 1 ] || [ "$oom_ahora" -le "$oom_antes" ] || oom_nuevo=1
  ooms=""
  [ "$oom_nuevo" = 0 ] || ooms="$(contenedores_con_oom "$ESTADO_DIR/oom.scopes.actual")"

  estado=OK ultimo=0 pasadas=0 ultimo_oom=0
  if [ -f "$ESTADO_DIR/estado" ]; then read -r estado ultimo pasadas ultimo_oom <"$ESTADO_DIR/estado" || true; fi
  bajo=0
  [ "$disponible" -ge "$UMBRAL_MIB" ] || bajo=1

  tipo="" motivo=""
  if [ "$estado" = "OK" ]; then
    if [ "$oom_nuevo" = 1 ]; then tipo=ALERTA motivo="OOM nuevo"; elif [ "$bajo" = 1 ]; then tipo=ALERTA motivo="memoria bajo el umbral"; fi
  elif [ "$oom_nuevo" = 1 ]; then
    tipo=PEOR motivo="otro OOM nuevo"
  elif [ "$bajo" = 1 ] && [ "$disponible" -le $((ultimo - PEOR_MIB)) ]; then
    tipo=PEOR motivo="la memoria bajó ${PEOR_MIB} MiB más"
  else
    if [ "$disponible" -ge $((UMBRAL_MIB + PEOR_MIB)) ] && [ $((ahora - ultimo_oom)) -ge "$OOM_CALMA_S" ]; then
      pasadas=$((pasadas + 1))
    else
      pasadas=0
    fi
    [ "$pasadas" -lt "$PASADAS_OK" ] || tipo=RESUELTO motivo="memoria recuperada"
  fi
  [ "$oom_nuevo" = 0 ] || ultimo_oom="$ahora"

  if [ -z "$tipo" ]; then
    [ "$estado" = "OK" ] || guardar_estado "$estado" "$ultimo" "$pasadas" "$ultimo_oom"
    mv -f "$ESTADO_DIR/oom.scopes.actual" "$ESTADO_DIR/oom.scopes"
    echo "$oom_ahora" >"$ESTADO_DIR/oom.total"
    return 0
  fi
  if enviar "$(armar_mensaje "$tipo" "$disponible" "$swap" "$oom_antes" "$oom_ahora" "$ooms")"; then
    if [ "$tipo" = "RESUELTO" ]; then guardar_estado OK 0 0 0; else guardar_estado ALERTA "$disponible" 0 "$ultimo_oom"; fi
    mv -f "$ESTADO_DIR/oom.scopes.actual" "$ESTADO_DIR/oom.scopes"
    echo "$oom_ahora" >"$ESTADO_DIR/oom.total"
    registrar "aviso $tipo enviado ($motivo; MemAvailable $disponible MiB)"
  else
    registrar "no se pudo enviar el aviso $tipo ($motivo; MemAvailable $disponible MiB) a Telegram; se reintenta en la próxima pasada"
  fi
}

salud() {
  minutos=$(((3 * INTERVALO_S + 59) / 60 + 1))
  [ ! -e "$ESTADO_DIR/sin-contador" ] || return 1
  [ -n "$(find "$ESTADO_DIR/latido" -mmin "-$minutos" 2>/dev/null)" ]
}

case "${1:-}" in
  --una-pasada) validar; pasada ;;
  --salud) salud ;;
  "")
    validar
    registrar "arranca: umbral ${UMBRAL_MIB} MiB, cada ${INTERVALO_S} s; solo avisa"
    while :; do
      pasada || registrar "pasada fallida"
      sleep "$INTERVALO_S"
    done
    ;;
  *) echo "uso: vigia.sh [--una-pasada | --salud]" >&2; exit 64 ;;
esac
