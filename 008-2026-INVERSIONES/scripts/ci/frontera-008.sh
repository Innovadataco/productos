#!/usr/bin/env bash
# Candado de frontera de 008: una rama work/inv-* solo puede tocar
# 008-2026-INVERSIONES/** y .github/workflows/inv.yml (condición 6 del CEO de PI).
#
# Uso: bash 008-2026-INVERSIONES/scripts/ci/frontera-008.sh [ref-base]   (por defecto origin/main)
# Lo que llegue por stdin se ignora: el diff lo hace este script (así el inv.yml
# viejo, que le pasaba la lista por tubería, sigue funcionando).
#
# - `--no-renames`: un `git mv` desde otro producto hacia 008 lista también la ruta de
#   origen (borrado fuera de la frontera); con detección de renombres solo saldría el destino.
# - `core.quotepath=off` + `-z`: rutas crudas, sin comillas ni escapes octales.
set -euo pipefail

base="${1:-origin/main}"

mostrar() { printf '%s' "${1//[[:cntrl:]]/?}"; }

lista="$(mktemp)"
trap 'rm -f "$lista"' EXIT
git -c core.quotepath=off diff --no-renames --name-only -z "${base}...HEAD" >"$lista"

fuera=0
while IFS= read -r -d '' ruta; do
  case "$ruta" in
    008-2026-INVERSIONES/*) ;;
    .github/workflows/inv.yml) ;;
    *)
      echo "❌ Fuera de la frontera de 008: $(mostrar "$ruta")"
      fuera=$((fuera + 1))
      ;;
  esac
done <"$lista"

if (( fuera > 0 )); then
  echo "❌ frontera-008: $fuera archivo(s) fuera de 008-2026-INVERSIONES/ e inv.yml. Ese cambio lo revisa y lo mergea el CEO de PI, no ECC."
  exit 1
fi
echo "✅ frontera-008: todos los cambios están dentro de 008-2026-INVERSIONES/ o inv.yml."
