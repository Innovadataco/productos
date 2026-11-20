#!/usr/bin/env bash
# Prueba por mutación del candado de frontera: tocar algo fuera de 008 DEBE fallar.
set -uo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
candado="$aqui/frontera-008.sh"
fallas=0

debe_fallar() {
  if printf '%b\n' "$1" | bash "$candado" >/dev/null 2>&1; then
    echo "❌ MUTANTE VIVO: la frontera dejó pasar «$1»"; fallas=$((fallas + 1))
  else
    echo "✅ bloquea: $1"
  fi
}
debe_pasar() {
  if printf '%b\n' "$1" | bash "$candado" >/dev/null 2>&1; then
    echo "✅ permite: $1"
  else
    echo "❌ FALSO POSITIVO: la frontera bloqueó «$1»"; fallas=$((fallas + 1))
  fi
}

debe_fallar "002-2026-PROTECCION-INFANTIL/src/app/page.tsx"
debe_fallar "008-2026-INVERSIONES/AGENTS.md\n002-2026-PROTECCION-INFANTIL/package.json"
debe_fallar ".github/workflows/ci.yml"
debe_fallar ".github/workflows/verificar-base-pr.yml"
debe_fallar "AGENTS.md"
debe_fallar "006-2026-BI-INTELIGENCIA-NEGOCIO/README.md"
debe_fallar "008-2026-INVERSIONES-falso/x.ts"

debe_pasar "008-2026-INVERSIONES/AGENTS.md"
debe_pasar "008-2026-INVERSIONES/app/src/page.tsx\n.github/workflows/inv.yml"

if (( fallas > 0 )); then echo "❌ $fallas caso(s) de la frontera fallaron"; exit 1; fi
echo "✅ frontera-008: todos los casos de mutación se comportan como se espera"
