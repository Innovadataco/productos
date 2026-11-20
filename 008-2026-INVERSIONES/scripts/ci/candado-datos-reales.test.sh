#!/usr/bin/env bash
# Prueba por mutación del candado: cada caso prohibido DEBE hacerlo fallar y cada
# caso permitido DEBE pasar. Si alguien afloja el candado, esta prueba se pone roja.
set -uo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
candado="$aqui/candado-datos-reales.sh"
fallas=0

debe_fallar() {
  if printf '%s\n' "$1" | bash "$candado" >/dev/null 2>&1; then
    echo "❌ MUTANTE VIVO: el candado dejó pasar «$1»"; fallas=$((fallas + 1))
  else
    echo "✅ bloquea: $1"
  fi
}
debe_pasar() {
  if printf '%s\n' "$1" | bash "$candado" >/dev/null 2>&1; then
    echo "✅ permite: $1"
  else
    echo "❌ FALSO POSITIVO: el candado bloqueó «$1»"; fallas=$((fallas + 1))
  fi
}

debe_fallar "008-2026-INVERSIONES/datos/ordenes.csv"
debe_fallar "008-2026-INVERSIONES/Informacion financiera.CSV"
debe_fallar "008-2026-INVERSIONES/certificacion.pdf"
debe_fallar "008-2026-INVERSIONES/portafolio.xlsx"
debe_fallar "008-2026-INVERSIONES/captura-portafolio.webp"
debe_fallar "008-2026-INVERSIONES/docs/captura.PNG"
debe_fallar "008-2026-INVERSIONES/.env"
debe_fallar "008-2026-INVERSIONES/backend/.env.production"

debe_pasar "008-2026-INVERSIONES/tests/fixtures/ordenes.ficticio.csv"
debe_pasar "008-2026-INVERSIONES/docs/mockup-tablero.ficticio.png"
debe_pasar "008-2026-INVERSIONES/.env.example"
debe_pasar "008-2026-INVERSIONES/AGENTS.md"
debe_pasar "008-2026-INVERSIONES/backend/app/main.py"

if (( fallas > 0 )); then echo "❌ $fallas caso(s) del candado fallaron"; exit 1; fi
echo "✅ candado-datos-reales: todos los casos de mutación se comportan como se espera"
