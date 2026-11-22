#!/usr/bin/env bash
# Inversiones · carga de los datos del dueño en producción SIN copias en el VPS (vía B del runbook).
# El sobre (parámetros y, si hace falta, el archivo) llega por la entrada estándar del SSH y pasa INTACTO al
# contenedor del migrador (/usr/local/bin/inv-cargar), que lo deja en un temporal 600 de su tmpfs, corre el CLI
# y lo borra. Este script no escribe nada en disco salvo sus candados: la entrada va de bash al cliente de
# Docker y de ahí al contenedor.
# En la línea de comandos solo va el nombre del comando (lista cerrada): ningún valor real queda en el registro
# de sudo, en `ps` del host ni en un historial.
#
# Lo corre Jelk o quien él designe, con su autorización directa (la da Jelk en persona, no otra sesión). Desde el Mac:
#   scripts/armar-sobre.sh <cabecera-privada> [<archivo>] | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh <comando>
#   (con `sudo -n` delante si el SSH no entra como root; <raíz>: ver ESTADO en la gestión)
# Comandos: importar-trii · registrar-escision · lote-escision · construir-lotes · importar-plan · registrar-fondo ·
#   importar-certificacion · importar-valores-fondo · importar-precios · conciliar-certificacion ·
#   corregir-corte-certificacion · registrar-movimiento-fondo · importar-series · importar-decretos ·
#   registrar-rendimientos-fondo · exportar-hechos-ia
# exportar-hechos-ia (solo lectura, sin archivo ni opciones) devuelve por stdout el JSON de los paquetes de hechos de la
# IA: «… | ssh … cargar-prod.sh exportar-hechos-ia > <archivo.json>» (este script solo escribe en stderr).
# Sale con el código del CLI (0, 1, 2 o 3), con 64 si inv-cargar se niega sin correrlo, o con 1 si se niega este script.

# Sin volcados de memoria ANTES de todo: este script maneja datos del dueño por stdin.
ulimit -c 0
set -euo pipefail
INV_SCRIPT=cargar-prod
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

COMANDOS_CARGA=(importar-trii registrar-escision lote-escision construir-lotes importar-plan registrar-fondo importar-certificacion importar-valores-fondo importar-precios conciliar-certificacion corregir-corte-certificacion)

# La constitución del fondo (unidades y aporte del extracto; sin archivo): scripts/registrar-movimiento-fondo.ts.
COMANDOS_CARGA+=(registrar-movimiento-fondo)

# Las series oficiales (el CSV canónico de los exportadores del Mac) y los decretos de dividendos (el CSV del dueño;
# ensayo por defecto): scripts/importar-series.ts y scripts/importar-decretos.ts.
COMANDOS_CARGA+=(importar-series importar-decretos)

# Los rendimientos del fondo y su retención (el CSV del dueño; ensayo por defecto): scripts/registrar-rendimientos-fondo.ts.
COMANDOS_CARGA+=(registrar-rendimientos-fondo)

# El export de hechos de la IA (E7), de solo lectura: los paquetes salen por stdout (scripts/exportar-hechos-ia.ts).
COMANDOS_CARGA+=(exportar-hechos-ia)

main() {
  # La entrada del sobre queda en el descriptor 3; nada más del script la puede consumir.
  exec 3<&0 0</dev/null
  [ $# -eq 1 ] || morir "uso: cargar-prod.sh <comando> (${COMANDOS_CARGA[*]}); los parámetros y el archivo van por la entrada estándar, nunca en la línea de comandos"
  case " ${COMANDOS_CARGA[*]} " in
    *" $1 "*) ;;
    *) morir "comando no permitido (solo ${COMANDOS_CARGA[*]})" ;;
  esac
  [ ! -t 3 ] || morir "la entrada es una terminal: el sobre llega por un tubo (scripts/armar-sobre.sh … | ssh …)"
  preparar_entorno
  revisar_arbol
  # La carga nunca levanta el respaldo: no depende de la configuración de respaldos.
  armar_compose --sin-respaldos
  tomar_candado_propio
  tomar_candado_comun
  negarse_si_pausado
  revisar_pi "antes de cargar"
  # Solo el sha que corre elige la imagen del migrador: nunca el INV_TAG del entorno.
  local sha
  sha="$( [ -r "$INV_ESTADO_DIR/sha-actual" ] && tr -d '[:space:]' <"$INV_ESTADO_DIR/sha-actual" || true)"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || morir "no hay despliegue registrado ($INV_ESTADO_DIR/sha-actual no es un sha de 40 hex): despliegue primero"
  export INV_TAG="$sha"
  informar "carga «$1» en el migrador del sha $sha (el sobre va por la entrada estándar; no se imprime)"
  local rc=0
  "${COMPOSE[@]}" run --rm -T --no-deps inv-008-migrador /usr/local/bin/inv-cargar "$1" <&3 3<&- || rc=$?
  exit "$rc"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
