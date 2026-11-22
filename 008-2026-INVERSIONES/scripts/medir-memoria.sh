#!/usr/bin/env bash
# Inversiones · medición de memoria del VPS compartido con PI: MemAvailable y SwapFree de /proc/meminfo,
# más `docker stats --no-stream` SOLO de los contenedores de inv-008-prod (nada de PI ni de otros), y un aviso por cada
# uno que pueda usar swap (memory.swap.max distinto de 0), con el comando que lo corrige (reaplicar-limites-008.sh).
# desplegar-prod.sh la corre antes de `up` y 10 minutos después, y deja las dos en estado/mediciones/.
# Criterio de corte: MemAvailable en reposo bajo 1 GiB.
#
# Uso: sudo scripts/medir-memoria.sh [--etiqueta <texto>] [--salida <archivo bajo la raíz de Inversiones>]
set -euo pipefail
INV_SCRIPT=medir-memoria
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

# Una línea de aviso por cada contenedor de 008 ($@, los ids de COMPOSE ps -q) cuyo cgroup le deja usar swap
# (memory.swap.max distinto de 0: el daemon-reload diario del host lo deja así), con el comando que lo corrige. Solo lee
# y nunca falla: corre dentro de la medición del despliegue, donde un error dispararía la vuelta atrás. Sin cgroup
# legible (en el Mac, el de Colima), no dice nada.
avisos_swap() {
  local raiz cid datos nombre largo dir swap_max
  raiz="$(raiz_cgroup 2>/dev/null)" || return 0
  for cid in "$@"; do
    datos="$(datos_limites "$cid" 2>/dev/null)" || continue
    IFS='|' read -r _ nombre _ _ largo <<<"$datos"
    dir="$(cgroup_de_contenedor "$largo" "$raiz")" || continue
    swap_max="$(valor_cgroup "$dir/memory.swap.max")"
    [ "$swap_max" != 0 ] || continue
    printf '⚠️  %s puede usar swap (memory.swap.max = %s): el tope de memoria no es real. Corra sudo %s/scripts/reaplicar-limites-008.sh (produccion.md §5)\n' \
      "$(limpio "${nombre#/}")" "$(limpio "$swap_max")" "$INV_DIR_008"
  done
  return 0
}

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
  revisar_arbol
  # Solo lee (`ps -q`): no depende de la configuración de respaldos.
  armar_compose --sin-respaldos
  if [ -n "$salida" ]; then
    salida="$(ruta_escribible "$salida")"
    mkdir -p "$(dirname "$salida")"
  fi

  local meminfo disponible swap_libre swap_total total texto avisos
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
    avisos="$(avisos_swap "${ids[@]}")"
    [ -z "$avisos" ] || texto+="$avisos"$'\n'
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
