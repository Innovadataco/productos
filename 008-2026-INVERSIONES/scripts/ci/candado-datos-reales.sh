#!/usr/bin/env bash
# Candado 008 · datos reales fuera del repo (productos es PÚBLICO).
# Recibe rutas (una por línea, por stdin) y falla si alguna es un archivo que
# típicamente trae datos reales: extractos, exportaciones, capturas o secretos.
# Excepción única: archivos de prueba INVENTADOS, marcados `.ficticio.` en el nombre.
# Uso: git ls-files 008-2026-INVERSIONES | bash 008-2026-INVERSIONES/scripts/ci/candado-datos-reales.sh
set -euo pipefail

prohibidos=0
while IFS= read -r ruta; do
  [[ -z "$ruta" ]] && continue
  nombre="$(basename "$ruta")"
  minus="$(printf '%s' "$nombre" | tr '[:upper:]' '[:lower:]')"

  # Secretos: cualquier .env salvo la plantilla .env.example
  if [[ "$minus" == .env* && "$minus" != ".env.example" ]]; then
    echo "❌ Secreto versionado: $ruta"
    prohibidos=$((prohibidos + 1))
    continue
  fi

  case "$minus" in
    *.csv|*.tsv|*.xlsx|*.xls|*.pdf|*.ofx|*.qif|*.png|*.jpg|*.jpeg|*.webp|*.heic)
      if [[ "$minus" != *.ficticio.* ]]; then
        echo "❌ Posible dato real (extracto, exportación o captura): $ruta"
        echo "   Si es un dato de prueba INVENTADO, renómbralo con «.ficticio.» (ej. ordenes.ficticio.csv)."
        prohibidos=$((prohibidos + 1))
      fi
      ;;
  esac
done

if (( prohibidos > 0 )); then
  echo "❌ candado-datos-reales: $prohibidos archivo(s) prohibido(s). Los datos reales viven solo en el servidor."
  exit 1
fi
echo "✅ candado-datos-reales: sin extractos, capturas ni secretos versionados."
