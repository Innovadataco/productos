#!/usr/bin/env bash
# Prueba por mutación del candado, de punta a punta: cada caso crea un repo git
# temporal con el archivo versionado y corre el candado igual que el CI.
# Cada caso prohibido DEBE hacerlo fallar y cada caso permitido DEBE pasar.
# Si alguien afloja el candado (o vuelve a leer rutas entrecomilladas), se pone rojo.
set -uo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
candado="$aqui/candado-datos-reales.sh"
tmp_raiz="$(mktemp -d)"
trap 'rm -rf "$tmp_raiz"' EXIT
fallas=0
n=0

# Devuelve 0 si el candado pasa con ese único archivo versionado en 008.
corre_candado_con() {
  n=$((n + 1))
  local repo="$tmp_raiz/r$n"
  mkdir -p "$repo/$(dirname "008-2026-INVERSIONES/$1")"
  git -C "$repo" init -q
  printf 'contenido inventado\n' >"$repo/008-2026-INVERSIONES/$1"
  git -C "$repo" add -f -- "008-2026-INVERSIONES/$1"
  (cd "$repo" && bash "$candado" >/dev/null 2>&1)
}

debe_fallar() {
  if corre_candado_con "$1"; then
    echo "❌ MUTANTE VIVO: el candado dejó pasar «$1»"; fallas=$((fallas + 1))
  else
    echo "✅ bloquea: $1"
  fi
}
debe_pasar() {
  if corre_candado_con "$1"; then
    echo "✅ permite: $1"
  else
    echo "❌ FALSO POSITIVO: el candado bloqueó «$1»"; fallas=$((fallas + 1))
  fi
}

# Extractos, exportaciones y capturas
debe_fallar "datos/ordenes.csv"
debe_fallar "Informacion financiera.CSV"
debe_fallar "certificacion.pdf"
debe_fallar "portafolio.xlsx"
debe_fallar "portafolio.ods"
debe_fallar "captura-portafolio.webp"
debe_fallar "docs/captura.PNG"
debe_fallar "docs/captura.gif"
# Nombres con tildes y eñes (git los entrecomilla si no se usa quotepath=off y -z)
debe_fallar "Información financiera.csv"
debe_fallar "Año 2026/extracto compañía.pdf"
debe_fallar "Posición.xlsx"
# Bases y comprimidos
debe_fallar "posiciones.zip"
debe_fallar "respaldo.sqlite"
debe_fallar "base.dump"
# Secretos y claves (sin excepción .ficticio.)
debe_fallar ".env"
debe_fallar "backend/.env.production"
debe_fallar "prod.env"
debe_fallar ".envrc"
debe_fallar "certs/servidor.pem"
debe_fallar "certs/servidor.ficticio.pem"

# Permitidos
debe_pasar "tests/fixtures/ordenes.ficticio.csv"
debe_pasar "tests/fixtures/dividendos año.ficticio.csv"
debe_pasar "docs/mockup-tablero.ficticio.png"
debe_pasar ".env.example"
debe_pasar "AGENTS.md"
debe_pasar "package.json"
debe_pasar "prisma/migrations/0001_inicial/migration.sql"
debe_pasar "src/app/page.tsx"
debe_pasar "docs/decisión.md"

if (( fallas > 0 )); then echo "❌ $fallas caso(s) del candado fallaron"; exit 1; fi
echo "✅ candado-datos-reales: todos los casos de mutación se comportan como se espera"
