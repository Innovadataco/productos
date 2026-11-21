#!/usr/bin/env bash
# Inversiones · pausa manual (o el corte por convivencia, que es manual): baja los contenedores del
# proyecto inv-008-prod con `down` SIN -v (la base y los respaldos quedan) y deja la marca
# /opt/inversiones-008/estado/pausado ANTES de bajar. Con la marca:
#  - no hay contenedores, así que un reinicio del VPS o de Docker NO levanta Inversiones (restart: always
#    no tiene a quién reiniciar);
#  - desplegar-prod.sh se niega y PI, al terminar su despliegue, no reanuda Inversiones.
# Durante los despliegues de PI la pausa la hace PI con su propio código (ver docs/despliegue/convivencia-pi.md).
#
# Uso: sudo /opt/inversiones-008/repo/008-2026-INVERSIONES/scripts/pausar-008.sh [motivo]
# Reanudar: scripts/reanudar-008.sh
set -euo pipefail
INV_SCRIPT=pausar-008
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  local motivo="${*:-pausa manual}"
  preparar_entorno
  armar_compose
  tomar_candado_propio
  escribir_atomico "$INV_MARCA_PAUSA" "$(date '+%Y-%m-%d %H:%M:%S %z') · ${motivo//[^[:alnum:] ._:-]/}"
  informar "marca de pausa: $INV_MARCA_PAUSA"
  "${COMPOSE[@]}" down
  informar "Inversiones en pausa: contenedores abajo, base y respaldos intactos. Reanudar: scripts/reanudar-008.sh"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
