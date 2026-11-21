#!/usr/bin/env bash
# Inversiones · construye las imágenes de producción EN EL MAC (el VPS de PI no construye nada).
#
#   scripts/construir-imagen.sh <sha> [--guardar <carpeta>]
#
# - Sale de `git archive <sha>` en una carpeta temporal, nunca de la carpeta de trabajo (lo que no está
#   en el commit no entra a la imagen).
# - `npm audit --omit=dev --audit-level=high` sobre esa copia: con una vulnerabilidad alta no construye.
# - `docker buildx build --platform linux/amd64` (el VPS es x86_64), sin attestations, de los targets
#   runner (inv-008-app:<sha>), migrador (inv-008-migrador:<sha>) y vigia (inv-008-vigia:<sha>), con
#   APP_VERSION=<sha> horneada.
# - Verifica la etiqueta org.opencontainers.image.revision == sha en las tres.
# - Con --guardar: `docker save` de las tres en <carpeta>/inv-008-<sha>.tar y su .sha256, para verificar
#   la integridad en el VPS antes de `docker load` (desplegar-prod.sh --cargar).
# Por stdout imprime SOLO el ID de la imagen de la app; todo lo demás va a stderr.
# INV_PLATAFORMA=linux/arm64 sirve solo para pruebas rápidas en el Mac (el despliegue exige amd64).
set -euo pipefail
INV_SCRIPT=construir-imagen
# shellcheck source=produccion-comun.sh
source "$(dirname "${BASH_SOURCE[0]}")/produccion-comun.sh"

main() {
  local sha="${1:-}" guardar=""
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || morir "uso: construir-imagen.sh <sha completo de 40 hex> [--guardar <carpeta>]"
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --guardar) guardar="${2:-}"; [ -n "$guardar" ] || morir "--guardar necesita una carpeta"; shift 2 ;;
      *) morir "opción desconocida: $1" ;;
    esac
  done
  local plataforma="${INV_PLATAFORMA:-linux/amd64}"
  case "$plataforma" in
    linux/amd64 | linux/arm64) ;;
    *) morir "plataforma no permitida: $plataforma" ;;
  esac

  local repo
  repo="$(git -C "$INV_DIR_008" rev-parse --show-toplevel)"
  git -C "$repo" cat-file -e "${sha}^{commit}" 2>/dev/null || morir "el sha $sha no existe en este clon (haga git fetch)"

  # Global (no local): la trampa EXIT corre después de que main termina.
  INV_TMP_IMAGEN="$(mktemp -d "${TMPDIR:-/tmp}/inv-008-imagen.XXXXXX")"
  trap 'rm -rf "$INV_TMP_IMAGEN"' EXIT
  git -C "$repo" archive --format=tar "$sha" 008-2026-INVERSIONES | tar -x -C "$INV_TMP_IMAGEN"
  local contexto="$INV_TMP_IMAGEN/008-2026-INVERSIONES"
  [ -f "$contexto/Dockerfile" ] || morir "el commit $sha no tiene 008-2026-INVERSIONES/Dockerfile"

  informar "npm audit (producción) sobre el código del commit"
  (cd "$contexto" && npm audit --omit=dev --audit-level=high) >&2 || morir "npm audit encontró vulnerabilidades altas: no se construye"

  local target etiqueta
  for target in runner migrador vigia; do
    case "$target" in
      runner) etiqueta="inv-008-app:$sha" ;;
      *) etiqueta="inv-008-$target:$sha" ;;
    esac
    informar "construyendo $etiqueta ($plataforma)"
    docker buildx build --platform "$plataforma" --target "$target" --build-arg "APP_VERSION=$sha" \
      --provenance=false --sbom=false --load -t "$etiqueta" "$contexto" >&2
    local revision
    revision="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$etiqueta")"
    [ "$revision" = "$sha" ] || morir "$etiqueta tiene la etiqueta revision «$revision», no $sha"
  done

  local id_app imagen
  id_app="$(docker image inspect -f '{{.Id}}' "inv-008-app:$sha")"
  for imagen in inv-008-app inv-008-migrador inv-008-vigia; do
    informar "$imagen:$sha → $(docker image inspect -f '{{.Id}}' "$imagen:$sha")"
  done

  if [ -n "$guardar" ]; then
    mkdir -p "$guardar"
    local tar="$guardar/inv-008-$sha.tar"
    docker save -o "$tar" "inv-008-app:$sha" "inv-008-migrador:$sha" "inv-008-vigia:$sha"
    (cd "$guardar" && printf '%s  %s\n' "$(sha256_de "inv-008-$sha.tar")" "inv-008-$sha.tar" >"inv-008-$sha.tar.sha256")
    informar "tar: $tar · sha256 $(cut -d' ' -f1 <"$tar.sha256") (verifíquelo en el VPS antes de docker load)"
  fi
  printf '%s\n' "$id_app"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
