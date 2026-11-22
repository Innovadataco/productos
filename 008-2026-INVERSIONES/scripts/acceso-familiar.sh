#!/usr/bin/env bash
# Inversiones · el acceso de un familiar (rol FAMILIA, solo lectura): alta o recuperación de la clave, revocación y
# reinicio de su segundo factor. Corre scripts/acceso-familiar.ts (frente familia-lectura) en el contenedor del
# migrador, con el rol inv_dueno, y deja que imprima UNA vez el enlace de un solo uso. Este script no guarda ni
# registra nada: el enlace solo sale en la terminal.
#
# Lo corre Jelk por SSH (nunca la Fábrica: maneja accesos), después de desplegar:
#   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/acceso-familiar.sh --email <correo-del-familiar> [--revocar | --reiniciar-totp]
#   (<raíz>: ver ESTADO en la gestión)
# Lista blanca ANTES de tocar nada: `--email <correo>` y, si acaso, UNA de --revocar o --reiniciar-totp. Ningún
# mensaje repite el correo. El CLI vuelve a validar todo (y en producción exige la conexión de inv_dueno).
set -euo pipefail
INV_SCRIPT=acceso-familiar
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

USO_FAMILIAR="uso: acceso-familiar.sh --email <correo-del-familiar> [--revocar | --reiniciar-totp]"

# La forma de un correo, como el contenedor de la carga (docker/migrador/cargar.sh): sin «-» al inicio, sin espacios
# ni controles y con una sola arroba. Si es un correo de verdad lo decide el CLI.
correo_familiar_valido() {
  case "$1" in
    -* | *[[:space:]]* | *@*@* | @* | *@) return 1 ;;
    ?*@?*.?*) ;;
    *) return 1 ;;
  esac
  [ "$(printf '%s' "$1" | LC_ALL=C tr -d '\001-\037\177')" = "$1" ] && [ "${#1}" -le 254 ]
}

# Falla con el uso si algo sale de la lista blanca. No imprime ningún valor recibido.
revisar_argumentos() {
  local correo="" accion=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --email)
        [ -z "$correo" ] || morir "--email repetido. $USO_FAMILIAR"
        { [ $# -ge 2 ] && correo_familiar_valido "$2"; } || morir "--email necesita un correo válido (no una opción). $USO_FAMILIAR"
        correo="$2"
        shift 2
        ;;
      --revocar | --reiniciar-totp)
        [ -z "$accion" ] || morir "una sola acción: --revocar o --reiniciar-totp. $USO_FAMILIAR"
        accion="$1"
        shift
        ;;
      *) morir "opción no permitida. $USO_FAMILIAR" ;;
    esac
  done
  [ -n "$correo" ] || morir "falta el correo. $USO_FAMILIAR"
}

main() {
  revisar_argumentos "$@"
  preparar_entorno
  revisar_arbol
  armar_compose --sin-respaldos
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado
  if [ -z "${INV_TAG:-}" ]; then
    [ -r "$INV_ESTADO_DIR/sha-actual" ] || morir "no hay despliegue registrado: despliegue primero"
    INV_TAG="$(tr -d '[:space:]' <"$INV_ESTADO_DIR/sha-actual")"
  fi
  # Como en crear-acceso-inicial.sh: solo un sha completo elige la imagen del migrador. No se imprime el valor recibido.
  [[ "$INV_TAG" =~ ^[0-9a-f]{40}$ ]] || morir "INV_TAG (o estado/sha-actual) no es un sha de 40 hex: no se corre el migrador"
  export INV_TAG
  "${COMPOSE[@]}" run --rm -T inv-008-migrador node_modules/.bin/tsx scripts/acceso-familiar.ts "$@"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
