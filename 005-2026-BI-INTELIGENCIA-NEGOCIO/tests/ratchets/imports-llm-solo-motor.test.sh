#!/bin/bash
# Self-test SPEC-011 Capa 11.2: verifica que el ratchet caza VANNA_BASE_URL
# fuera de la whitelist e ignora usos legítimos.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/../.."
cd "$ROOT" || exit 2

RATCHET="scripts/ratchets/imports-llm-solo-motor.sh"
VIOLA="src/__ratchet_tmp_viola.ts"

fail() {
    echo "❌ self-test $1"
    rm -f "$VIOLA"
    exit 1
}

# Baseline: ratchet debe pasar en el árbol limpio
if ! bash "$RATCHET" > /dev/null; then
    fail "baseline no pasa"
fi

# Inyecta violación: VANNA_BASE_URL fuera de vanna-client.ts
cat > "$VIOLA" <<'EOF'
export const test = async () => {
    return fetch(process.env.VANNA_BASE_URL + "/x");
};
EOF

if bash "$RATCHET" > /dev/null 2>&1; then
    fail "no detectó la violación"
fi

# Limpia · debe volver a pasar
rm -f "$VIOLA"
if ! bash "$RATCHET" > /dev/null; then
    fail "no vuelve a pasar tras limpiar"
fi

echo "✅ ratchet-selftest imports-llm-solo-motor OK"
