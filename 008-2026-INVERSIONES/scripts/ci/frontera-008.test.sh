#!/usr/bin/env bash
# Prueba por mutación del candado de frontera, de punta a punta: cada caso crea un
# repo git temporal con una rama base y una rama de trabajo, y corre la frontera
# igual que el CI. Tocar algo fuera de 008 (incluido mover un archivo de otro
# producto hacia 008) DEBE fallar.
set -uo pipefail
aqui="$(cd "$(dirname "$0")" && pwd)"
frontera="$aqui/frontera-008.sh"
tmp_raiz="$(mktemp -d)"
trap 'rm -rf "$tmp_raiz"' EXIT
fallas=0
n=0

g() { git -C "$repo" -c user.name=prueba -c user.email=prueba@ejemplo.invalid "$@"; }
escribir() { mkdir -p "$repo/$(dirname "$1")"; printf '%s\n' "${2:-x}" >"$repo/$1"; }

# Crea un repo con una base que ya tiene archivos de otros productos y de 008.
repo_nuevo() {
  n=$((n + 1))
  repo="$tmp_raiz/r$n"
  mkdir -p "$repo"
  g init -q
  escribir "002-2026-PROTECCION-INFANTIL/src/app/page.tsx"
  escribir "002-2026-PROTECCION-INFANTIL/package.json"
  escribir "008-2026-INVERSIONES/AGENTS.md"
  escribir ".github/workflows/inv.yml"
  escribir "AGENTS.md"
  g add -A && g commit -q -m base && g tag base
}

# $1 = resultado esperado (pasa|falla) · $2 = descripción · $3 = función que aplica los cambios
caso() {
  local esperado="$1" desc="$2" cambios="$3"
  repo_nuevo
  if ! { "$cambios" && g add -A && g commit -q -m trabajo; } >/dev/null 2>&1; then
    echo "❌ no se pudo preparar el caso «$desc»"; fallas=$((fallas + 1)); return
  fi
  if (cd "$repo" && bash "$frontera" base >/dev/null 2>&1); then resultado=pasa; else resultado=falla; fi
  if [[ "$resultado" == "$esperado" ]]; then
    echo "✅ $esperado: $desc"
  else
    echo "❌ esperaba que «$desc» $esperado, pero $resultado"; fallas=$((fallas + 1))
  fi
}

toca_pi()          { escribir "002-2026-PROTECCION-INFANTIL/src/app/page.tsx" cambio; }
toca_008_y_pi()    { escribir "008-2026-INVERSIONES/AGENTS.md" cambio; escribir "002-2026-PROTECCION-INFANTIL/package.json" cambio; }
toca_otro_workflow() { escribir ".github/workflows/ci.yml"; }
toca_agents_raiz() { escribir "AGENTS.md" cambio; }
toca_008_falso()   { escribir "008-2026-INVERSIONES-falso/x.ts"; }
mueve_pi_a_008()   { g mv "002-2026-PROTECCION-INFANTIL/package.json" "008-2026-INVERSIONES/package.json"; }
borra_de_pi()      { g rm -q "002-2026-PROTECCION-INFANTIL/src/app/page.tsx"; }
toca_008()         { escribir "008-2026-INVERSIONES/AGENTS.md" cambio; }
toca_008_tilde()   { escribir "008-2026-INVERSIONES/docs/decisión año.md"; }
toca_008_e_inv()   { escribir "008-2026-INVERSIONES/src/app/page.tsx"; escribir ".github/workflows/inv.yml" cambio; }
mueve_dentro_008() { mkdir -p "$repo/008-2026-INVERSIONES/docs"; g mv "008-2026-INVERSIONES/AGENTS.md" "008-2026-INVERSIONES/docs/AGENTS.md"; }

caso falla "toca un archivo de PI" toca_pi
caso falla "toca 008 y un archivo de PI" toca_008_y_pi
caso falla "crea otro workflow" toca_otro_workflow
caso falla "toca el AGENTS.md de la raíz" toca_agents_raiz
caso falla "carpeta con prefijo engañoso 008-2026-INVERSIONES-falso" toca_008_falso
caso falla "mueve (git mv) un archivo de PI hacia 008" mueve_pi_a_008
caso falla "borra un archivo de PI" borra_de_pi
caso pasa  "toca solo 008" toca_008
caso pasa  "archivo de 008 con tildes y eñes" toca_008_tilde
caso pasa  "toca 008 e inv.yml" toca_008_e_inv
caso pasa  "mueve un archivo dentro de 008" mueve_dentro_008

if (( fallas > 0 )); then echo "❌ $fallas caso(s) de la frontera fallaron"; exit 1; fi
echo "✅ frontera-008: todos los casos de mutación se comportan como se espera"
