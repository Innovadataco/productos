#!/usr/bin/env bash
# Inversiones · reanuda después de una pausa: `up -d --wait` con el sha que estaba corriendo
# (estado/sha-actual) y borra la marca de pausa solo si todo quedó healthy. Se niega si PI está
# desplegando: el candado común tomado («PI desplegando») o un proceso de despliegue o build de PI a la vista
# (segunda barrera). Exige la configuración no secreta (inv-008.conf): el up levanta el respaldo. El servicio de precios
# (D-018) sube solo si la imagen de ese sha lo trae; si no, se baja con --scale inv-008-precios=0.
#
# Uso: sudo <raíz>/repo/008-2026-INVERSIONES/scripts/reanudar-008.sh   (<raíz>: ver ESTADO en la gestión)
set -euo pipefail
INV_SCRIPT=reanudar-008
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

# ¿La imagen del sha $1 trae el servicio de precios (D-018)? Se mira en el clon, sin contenedores ni red: el commit de la
# imagen (su etiqueta revision es ese sha) trae src/servicio-precios/bucle.ts. 0 sí · 1 no (una imagen anterior al
# servicio: su bundle no tiene el modo «bucle», saldría con 2 en un bucle de reinicios y el --wait fallaría) · 2 no se
# puede saber (el clon no tiene ese commit). Igual en desplegar-prod.sh (lo cuida desplegar-precios.test.ts).
imagen_con_servicio_precios() {
  local git_clon=(env -i PATH="$PATH" GIT_CONFIG_NOSYSTEM=1 git --no-replace-objects -C "$INV_DIR_008")
  "${git_clon[@]}" cat-file -e "$1^{commit}" 2>/dev/null || return 2
  "${git_clon[@]}" cat-file -e "$1:./src/servicio-precios/bucle.ts" 2>/dev/null || return 1
  return 0
}

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
  # El servicio de precios solo con una imagen que lo trae; si no (una vuelta atrás a un sha anterior) o no se sabe, se
  # baja (--scale 0): saldría con 2 en un bucle de reinicios, el --wait fallaría y la marca de pausa quedaría puesta.
  local sin_precios=() rc=0
  imagen_con_servicio_precios "$sha" || rc=$?
  case "$rc" in
    0) ;;
    1) informar "⚠️  la imagen del sha que corre no trae el servicio de precios (es anterior a él): se baja inv-008-precios y se levanta lo demás"; sin_precios=(--scale inv-008-precios=0) ;;
    *) informar "⚠️  no se pudo saber si la imagen del sha que corre trae el servicio de precios (el clon no tiene $sha): se baja inv-008-precios y se levanta lo demás"; sin_precios=(--scale inv-008-precios=0) ;;
  esac
  informar "levantando Inversiones con el sha $sha (up -d --wait)"
  "${COMPOSE[@]}" up -d --wait --wait-timeout 180 ${sin_precios[@]+"${sin_precios[@]}"} || morir "Inversiones no quedó healthy: la marca de pausa se mantiene"
  rm -f "$(ruta_escribible "$INV_MARCA_PAUSA")"
  informar "Inversiones reanudada (sha $sha); marca de pausa borrada"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
