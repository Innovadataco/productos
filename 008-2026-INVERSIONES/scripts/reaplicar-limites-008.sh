#!/usr/bin/env bash
# Inversiones · reaplica los límites de memoria (mem = memswap) a los contenedores de 008 que corren, sin reiniciar
# nada. Para correrlo a mano cuando medir-memoria.sh avisa que un contenedor de 008 puede usar swap; desplegar-prod.sh
# y reanudar-008.sh hacen lo mismo por su cuenta.
# Causa: cada noche un `daemon-reload` de systemd en el host (una tarea del agente qemu-ga del proveedor) deja
# memory.swap.max en max en el cgroup de todo contenedor que esté corriendo; docker inspect sigue diciendo
# Memory = MemorySwap. La solución de fondo, en el host, la decide PI (produccion.md §5).
# Qué hace (reaplicar_limites, en produccion-comun.sh): solo con los contenedores del proyecto (COMPOSE y su etiqueta),
# `docker update --memory M --memory-swap M` con M = el HostConfig.Memory de cada uno, una línea de log por corrección y
# una revisión del cgroup después. Toma el candado de Inversiones y el común con PI, sin esperar.
#
# Uso: sudo <raíz>/repo/008-2026-INVERSIONES/scripts/reaplicar-limites-008.sh   (<raíz>: ver ESTADO en la gestión)
set -euo pipefail
INV_SCRIPT=reaplicar-limites-008
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  [ $# -eq 0 ] || morir "no lleva argumentos"
  preparar_entorno
  revisar_arbol
  # Solo lista, inspecciona y actualiza contenedores que ya corren: no depende de la configuración de respaldos.
  armar_compose --sin-respaldos
  tomar_candado_propio
  tomar_candado_comun
  reaplicar_limites
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
