#!/usr/bin/env bash
# Inversiones · reanuda después de una pausa: `up -d --wait` con el sha que estaba corriendo
# (estado/sha-actual) y borra la marca de pausa solo si todo quedó healthy. Se niega si PI está
# desplegando: el candado común tomado («PI desplegando») o un proceso de despliegue o build de PI a la vista
# (segunda barrera). Exige la configuración no secreta (inv-008.conf): el up levanta el respaldo.
#
# Uso: sudo <raíz>/repo/008-2026-INVERSIONES/scripts/reanudar-008.sh   (<raíz>: ver ESTADO en la gestión)
set -euo pipefail
INV_SCRIPT=reanudar-008
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  [ $# -eq 0 ] || morir "no lleva argumentos"
  preparar_entorno
  revisar_arbol
  armar_compose
  local sha
  sha="$( [ -r "$INV_ESTADO_DIR/sha-actual" ] && tr -d '[:space:]' <"$INV_ESTADO_DIR/sha-actual" || true)"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || morir "no hay despliegue registrado ($INV_ESTADO_DIR/sha-actual): use desplegar-prod.sh"
  tomar_candado_propio
  tomar_candado_comun
  revisar_pi "antes de reanudar"
  export INV_TAG="$sha"
  respaldos_siguen_validos || morir "la carpeta de respaldos dejó de pasar la validación antes del up: no se levanta nada"
  informar "levantando Inversiones con el sha $sha (up -d --wait)"
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 || morir "Inversiones no quedó healthy: la marca de pausa se mantiene"
  rm -f "$(ruta_escribible "$INV_MARCA_PAUSA")"
  informar "Inversiones reanudada (sha $sha); marca de pausa borrada"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
