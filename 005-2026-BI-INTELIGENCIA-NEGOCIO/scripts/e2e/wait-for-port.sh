#!/usr/bin/env bash
# SPEC-014 · espera a que un puerto TCP esté abierto.
# Uso: ./wait-for-port.sh host puerto max_segundos
set -euo pipefail

HOST="${1:-localhost}"
PORT="${2:-5432}"
MAX="${3:-60}"

echo "esperando ${HOST}:${PORT} (max ${MAX}s)..."
for i in $(seq 1 "$MAX"); do
    if nc -z "$HOST" "$PORT" 2>/dev/null; then
        echo "OK ${HOST}:${PORT} en ${i}s"
        exit 0
    fi
    sleep 1
done
echo "TIMEOUT esperando ${HOST}:${PORT}" >&2
exit 1
