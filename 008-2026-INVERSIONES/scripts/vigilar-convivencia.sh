#!/usr/bin/env bash
# Inversiones · revisión de convivencia con PI, UNA sola pasada. Solo DETECTA e INFORMA: el corte es manual
# (sale con 3 y da el comando). La vigilancia continua es el contenedor inv-008-vigia, que solo avisa.
# Criterio:
#  - MemAvailable bajo 1 GiB, o
#  - un OOM nuevo en el VPS: sube el oom_kill JERÁRQUICO del cgroup de los contenedores
#    (/sys/fs/cgroup/system.slice/memory.events, o docker/ con el driver cgroupfs). Persiste aunque el
#    contenedor muerto se haya recreado.
# No usa Docker para nada: ni sobre pi-* ni sobre Inversiones.
#
# Uso: sudo scripts/vigilar-convivencia.sh       (desplegar-prod.sh la corre al final)
set -euo pipefail
INV_SCRIPT=vigilar-convivencia
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  [ $# -eq 0 ] || morir "no lleva argumentos"
  preparar_entorno
  revisar_arbol
  local meminfo disponible motivos=() total base anterior
  meminfo="$(archivo_meminfo)"
  disponible="$(leer_meminfo_kb MemAvailable "$meminfo")" || morir "no se pudo leer MemAvailable de $meminfo"
  if [ "$disponible" -lt "$UMBRAL_CORTE_KB" ]; then
    motivos+=("MemAvailable $((disponible / 1024)) MiB, bajo 1024 MiB")
  fi

  total="$(oom_total "$(raiz_cgroup)")" || morir "no se pudo leer el oom_kill jerárquico de $(raiz_cgroup): no se vigila a ciegas"
  base="$(ruta_escribible "$INV_ESTADO_DIR/convivencia-oom.txt")"
  anterior="$( [ -r "$base" ] && tr -d '[:space:]' <"$base" || true)"
  if [[ "$anterior" =~ ^[0-9]+$ ]] && [ "$total" -gt "$anterior" ]; then
    motivos+=("OOM nuevo en el VPS (oom_kill de los contenedores $anterior → $total)")
  fi
  escribir_atomico "$base" "$total"

  if [ "${#motivos[@]}" -gt 0 ]; then
    informar "CRITERIO DE CORTE: ${motivos[*]}"
    informar "el corte es MANUAL: sudo $INV_DIR_008/scripts/pausar-008.sh"
    exit 3
  fi
  informar "OK: MemAvailable $((disponible / 1024)) MiB; sin OOM nuevos (oom_kill jerárquico $total)"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
