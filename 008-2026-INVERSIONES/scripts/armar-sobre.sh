#!/usr/bin/env bash
# Inversiones · arma en el Mac el «sobre» de una carga en producción y lo escribe por stdout, para mandarlo por
# SSH a scripts/cargar-prod.sh. Los valores reales salen de un archivo PRIVADO del Mac (la cabecera), nunca de
# la línea de comandos: así no quedan en el historial de la shell ni en una transcripción.
#
# Uso (lo corre Jelk o quien él designe, con su autorización directa: la da Jelk en persona, no otra sesión):
#   scripts/armar-sobre.sh <cabecera> [<archivo>] | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh <comando>
#   <cabecera>: un argumento del CLI por línea, por ejemplo «--email» y en la línea siguiente el correo. Vacía (o
#   /dev/null) para un comando sin argumentos.
#   <archivo>: el CSV de Trii, la ficha, el PDF de la certificación o el CSV de cierres (importar-trii, importar-plan,
#   importar-certificacion e importar-precios).
#
# Formato (lo lee docker/migrador/cargar.sh): una cabecera de EXACTAMENTE 4096 bytes (los argumentos, uno por
# línea; con archivo, además --bytes <N> y --sha256 <H>; una línea vacía; relleno de líneas vacías) y después el
# archivo tal cual. El sha256 frena un archivo truncado por un corte del SSH.
# No imprime ningún valor: solo errores con el número de línea.
set -euo pipefail
INV_SCRIPT=armar-sobre
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

BLOQUE_CABECERA=4096
MAX_LINEAS_USUARIO=30
MAX_LARGO_LINEA=512

main() {
  [ $# -ge 1 ] && [ $# -le 2 ] || morir "uso: armar-sobre.sh <cabecera> [<archivo>] | ssh … cargar-prod.sh <comando>"
  local cabecera="$1" archivo="${2:-}" linea n=0 bloque bytes sha
  [ ! -t 1 ] || morir "la salida es una terminal: el sobre lleva datos reales y va por un tubo a ssh, nunca a la pantalla"
  # Una cabecera vacía (o /dev/null) es válida: un comando sin argumentos, como construir-lotes.
  [ -r "$cabecera" ] && [ ! -d "$cabecera" ] || morir "no se puede leer la cabecera"
  bloque=""
  while IFS= read -r linea || [ -n "$linea" ]; do
    n=$((n + 1))
    [ "$n" -le "$MAX_LINEAS_USUARIO" ] || morir "la cabecera pasa de $MAX_LINEAS_USUARIO líneas"
    [ -n "$linea" ] || morir "la línea $n de la cabecera está vacía (corta la cabecera)"
    [ "$(printf '%s' "$linea" | LC_ALL=C wc -c | tr -d ' ')" -le "$MAX_LARGO_LINEA" ] || morir "la línea $n de la cabecera pasa de $MAX_LARGO_LINEA bytes"
    [ "$(printf '%s' "$linea" | LC_ALL=C tr -d '\001-\037\177')" = "$linea" ] || morir "la línea $n de la cabecera tiene un carácter de control"
    case "$linea" in --bytes | --sha256) morir "la línea $n usa una opción reservada del sobre (--bytes o --sha256)" ;; esac
    bloque+="$linea"$'\n'
  done <"$cabecera"
  if [ -n "$archivo" ]; then
    [ -f "$archivo" ] && [ -r "$archivo" ] || morir "no se puede leer el archivo"
    bytes="$(wc -c <"$archivo" | tr -d ' ')"
    sha="$(sha256_de "$archivo")"
    bloque+="--bytes"$'\n'"$bytes"$'\n'"--sha256"$'\n'"$sha"$'\n'
  fi
  bloque+=$'\n'
  [ "$(printf '%s' "$bloque" | LC_ALL=C wc -c | tr -d ' ')" -le "$BLOQUE_CABECERA" ] || morir "la cabecera pasa de $BLOQUE_CABECERA bytes"
  {
    printf '%s' "$bloque"
    # Relleno de líneas vacías hasta completar el bloque.
    head -c $((BLOQUE_CABECERA - $(printf '%s' "$bloque" | LC_ALL=C wc -c | tr -d ' '))) /dev/zero | LC_ALL=C tr '\000' '\n'
    [ -z "$archivo" ] || cat "$archivo"
  }
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
