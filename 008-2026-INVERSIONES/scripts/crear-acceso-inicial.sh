#!/usr/bin/env bash
# Inversiones · acceso inicial y recuperación de acceso. Corre scripts/crear-acceso-inicial.ts (del frente
# login) en el contenedor del migrador, con el rol inv_dueno, y deja que imprima UNA vez el enlace de un
# solo uso. Este script no guarda ni registra nada: el enlace solo sale en la terminal.
#
# Lo corre Jelk por SSH (no la Fábrica), ANTES de cargar los datos reales:
#   sudo <raíz>/repo/008-2026-INVERSIONES/scripts/crear-acceso-inicial.sh [argumentos del .ts]
#   (<raíz>: ver ESTADO en la gestión)
set -euo pipefail
INV_SCRIPT=crear-acceso-inicial
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
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
  # Como en desplegar-prod.sh: solo un sha completo elige la imagen del migrador (nunca latest ni otra cosa).
  # No se imprime el valor recibido.
  [[ "$INV_TAG" =~ ^[0-9a-f]{40}$ ]] || morir "INV_TAG (o estado/sha-actual) no es un sha de 40 hex: no se corre el migrador"
  export INV_TAG
  "${COMPOSE[@]}" run --rm -T inv-008-migrador node_modules/.bin/tsx scripts/crear-acceso-inicial.ts "$@"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
