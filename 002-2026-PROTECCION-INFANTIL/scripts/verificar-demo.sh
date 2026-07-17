#!/usr/bin/env bash
# Verifica el estado de reportes demo en PostgreSQL
# Uso por SSH:
#   bash scripts/verificar-demo.sh

set -euo pipefail

# Ajusta estos valores si tu BD es diferente
DB_URL="${DATABASE_URL:-postgresql://proteccion:proteccion_dev@localhost:5433/proteccion_infantil}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/verificar-demo.sql"

echo "Conectando a BD..."
psql "$DB_URL" -f "$SQL_FILE"
