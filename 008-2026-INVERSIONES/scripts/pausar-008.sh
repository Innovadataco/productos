#!/usr/bin/env bash
# Inversiones · pausa manual de las operaciones de 008 (o el corte por convivencia, que es manual): baja los
# contenedores del proyecto inv-008-prod con `down` SIN -v (la base y los respaldos quedan) y deja la marca
# <raíz>/estado/pausado ANTES de bajar. Con la marca:
#  - no hay contenedores, así que un reinicio del VPS o de Docker NO levanta Inversiones (restart: always
#    no tiene a quién reiniciar);
#  - desplegar-prod.sh se niega y PI, al terminar su despliegue, no reanuda Inversiones.
# PI no usa este script: durante sus despliegues pausa con su propio código (docker stop por la etiqueta del
# proyecto; ver docs/despliegue/convivencia-pi.md). Lo compartido con PI es solo la marca y el candado común.
#
# Nunca se rompe por interpolación: el down va solo con el nombre del proyecto (COMPOSE_PAUSA, sin -f ni
# --env-file) y no lee la configuración no secreta. Si ese down falla (un compose que no lo admita), cae al
# compose del clon con el centinela. Con las anclas de la raíz rotas no escribe nada: baja por nombre y sale
# con error («SIN marca»).
#
# Uso: sudo <raíz>/repo/008-2026-INVERSIONES/scripts/pausar-008.sh [motivo]   (<raíz>: ver ESTADO en la gestión)
# Reanudar: scripts/reanudar-008.sh
set -euo pipefail
INV_SCRIPT=pausar-008
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

# Down de la pausa: primero solo con el nombre del proyecto; si falla, con el compose del clon y el centinela
# (sin leer la configuración). Si los dos fallan, sale con error y la marca queda.
bajar_por_pausa() {
  "${COMPOSE_PAUSA[@]}" down && return 0
  informar "⚠️  el down por nombre de proyecto falló: se intenta con el compose del clon"
  armar_compose --sin-respaldos
  "${COMPOSE[@]}" down
}

main() {
  local motivo="${*:-pausa manual}"
  preparar_entorno --pausa
  if [ "$INV_ANCLAS_OK" = 0 ]; then
    informar "⚠️  anclas de la raíz rotas: ${INV_ANCLAS_MALAS}· no se escribe nada; down de último recurso por nombre de proyecto"
    "${COMPOSE_PAUSA[@]}" down || morir "el down de último recurso también falló: revise a mano"
    morir "Inversiones abajo SIN marca de pausa: un despliegue o PI podrían levantarla. Corrija las anclas y vuelva a pausar"
  fi
  revisar_arbol --solo-avisar
  tomar_candado_propio
  escribir_atomico "$INV_MARCA_PAUSA" "$(date '+%Y-%m-%d %H:%M:%S %z') · ${motivo//[^[:alnum:] ._:-]/}"
  informar "marca de pausa: $INV_MARCA_PAUSA"
  bajar_por_pausa
  informar "Inversiones en pausa: contenedores abajo, base y respaldos intactos. Reanudar: scripts/reanudar-008.sh"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
