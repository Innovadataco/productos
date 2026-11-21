#!/usr/bin/env bash
# Inversiones · medición de memoria del VPS compartido con PI: MemAvailable y SwapFree de /proc/meminfo,
# más `docker stats --no-stream` SOLO de los contenedores de inv-008-prod (nada de PI ni de otros).
# desplegar-prod.sh la corre antes de `up` y 10 minutos después, y deja las dos en estado/mediciones/.
# Criterio de corte: MemAvailable en reposo bajo 1 GiB.
#
# Uso: sudo scripts/medir-memoria.sh [--etiqueta <texto>] [--salida <archivo bajo /opt/inversiones-008>]
set -euo pipefail
INV_SCRIPT=medir-memoria
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  local etiqueta="medición" salida=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --etiqueta) etiqueta="${2:-}"; shift 2 ;;
      --salida) salida="${2:-}"; shift 2 ;;
      *) morir "opción desconocida: $1" ;;
    esac
  done
  preparar_entorno
  armar_compose
  if [ -n "$salida" ]; then
    salida="$(ruta_escribible "$salida")"
    mkdir -p "$(dirname "$salida")"
  fi

  local meminfo disponible swap_libre swap_total total texto
  meminfo="$(archivo_meminfo)"
  disponible="$(leer_meminfo_kb MemAvailable "$meminfo")" || morir "no se pudo leer MemAvailable de $meminfo"
  swap_libre="$(leer_meminfo_kb SwapFree "$meminfo")" || morir "no se pudo leer SwapFree de $meminfo"
  swap_total="$(leer_meminfo_kb SwapTotal "$meminfo")" || swap_total=0
  total="$(leer_meminfo_kb MemTotal "$meminfo")" || total=0

  texto="== $etiqueta · $(date '+%Y-%m-%d %H:%M:%S %z')"$'\n'
  texto+="MemAvailable: $((disponible / 1024)) MiB de $((total / 1024)) MiB · SwapFree: $((swap_libre / 1024)) MiB de $((swap_total / 1024)) MiB (swap en uso: $(((swap_total - swap_libre) / 1024)) MiB)"$'\n'
  if [ "$disponible" -lt "$UMBRAL_CORTE_KB" ]; then
    texto+="⚠️  MemAvailable bajo el umbral de corte (1024 MiB): ver docs/despliegue/convivencia-pi.md"$'\n'
  fi
  local ids=()
  while IFS= read -r id; do [ -z "$id" ] || ids+=("$id"); done < <("${COMPOSE[@]}" ps -q)
  if [ "${#ids[@]}" -gt 0 ]; then
    texto+="$(docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}' "${ids[@]}")"$'\n'
  else
    texto+="(sin contenedores de $INV_PROYECTO_ACTIVO corriendo)"$'\n'
  fi

  printf '%s' "$texto"
  if [ -n "$salida" ]; then
    printf '%s' "$texto" >>"$salida"
  fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
