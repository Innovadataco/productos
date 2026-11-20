#!/usr/bin/env bash
# Candado de frontera de 008: una rama work/inv-* solo puede tocar
# 008-2026-INVERSIONES/** y .github/workflows/inv.yml (condición 6 del CEO de PI).
# Recibe por stdin las rutas cambiadas (una por línea).
# Uso en CI: git diff --name-only origin/main...HEAD | bash 008-2026-INVERSIONES/scripts/ci/frontera-008.sh
set -euo pipefail

fuera=0
while IFS= read -r ruta; do
  [[ -z "$ruta" ]] && continue
  case "$ruta" in
    008-2026-INVERSIONES/*) ;;
    .github/workflows/inv.yml) ;;
    *)
      echo "❌ Fuera de la frontera de 008: $ruta"
      fuera=$((fuera + 1))
      ;;
  esac
done

if (( fuera > 0 )); then
  echo "❌ frontera-008: $fuera archivo(s) fuera de 008-2026-INVERSIONES/ e inv.yml. Ese cambio lo revisa y lo mergea el CEO de PI, no ECC."
  exit 1
fi
echo "✅ frontera-008: todos los cambios están dentro de 008-2026-INVERSIONES/ o inv.yml."
