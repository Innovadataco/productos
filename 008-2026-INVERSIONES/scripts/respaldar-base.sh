#!/usr/bin/env bash
# Inversiones · respaldo cifrado YA (por ejemplo, antes de migrar). Le pide el respaldo al contenedor
# permanente inv-008-respaldo, que es quien vuelca y cifra (pg_dump | age -r <pública>, sin texto plano en
# disco) y escribe en la carpeta de respaldos de la configuración no secreta (inv-008.conf; el valor real, en el
# ESTADO de la gestión). Este script solo verifica el resultado en el host:
# que el archivo exista bajo la raíz, que sea de age y que cuadre con su .sha256.
# El respaldo DIARIO lo programa el mismo contenedor (sin systemd ni cron del host).
#
# Uso (en el VPS): sudo scripts/respaldar-base.sh [--motivo <a-z0-9->]
# Imprime la ruta del respaldo nuevo en el host.
set -euo pipefail
INV_SCRIPT=respaldar-base
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  local motivo="" argumentos=(--ahora)
  while [ $# -gt 0 ]; do
    case "$1" in
      --motivo)
        motivo="${2:-}"
        [[ "$motivo" =~ ^[a-z0-9-]{1,32}$ ]] || morir "motivo inválido (solo a-z, 0-9 y -)"
        [ "$motivo" != "semanal" ] || morir "«semanal» es reservado"
        argumentos+=(--motivo "$motivo")
        shift 2
        ;;
      *) morir "opción desconocida: $1" ;;
    esac
  done
  preparar_entorno
  revisar_arbol
  armar_compose
  local dir
  dir="$(ruta_escribible "$INV_RESPALDOS_DIR")"

  informar "pidiendo un respaldo al contenedor inv-008-respaldo"
  local salida nombre archivo
  salida="$("${COMPOSE[@]}" exec -T inv-008-respaldo /usr/local/bin/inv-respaldo "${argumentos[@]}" | tail -n 1)" ||
    morir "el contenedor de respaldo falló (¿está corriendo? $INV_SCRIPT necesita inv-008-respaldo arriba)"
  nombre="${salida##*/}"
  [[ "$nombre" =~ ^inv-008-[0-9]{8}-[0-9]{6}(-[a-z0-9-]+)?\.dump\.age$ ]] || morir "el contenedor devolvió un nombre inesperado: $salida"
  archivo="$(ruta_escribible "$dir/$nombre")"
  [ -f "$archivo" ] || morir "no aparece $archivo en el host"
  [ "$(head -c 21 "$archivo")" = "age-encryption.org/v1" ] || morir "$archivo no es un archivo de age"
  [ "$(cut -d' ' -f1 <"$archivo.sha256")" = "$(sha256_de "$archivo")" ] || morir "el sha256 de $archivo no cuadra"
  informar "respaldo verificado: $archivo"
  printf '%s\n' "$archivo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
