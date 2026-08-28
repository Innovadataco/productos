#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/cero-sql-raw.sh"
bash "$SCRIPT_DIR/cero-secretos.sh"
bash "$SCRIPT_DIR/imports-llm-solo-motor.sh"
bash "$SCRIPT_DIR/no-additional-properties-true.sh"
echo "✅ Todos los ratchets OK"
