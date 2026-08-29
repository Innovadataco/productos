#!/usr/bin/env bash
# SPEC-014 · levanta compose test + migra + seed catálogo.
set -euo pipefail

cd "$(dirname "$0")/../.."

TS=$(date +%s)
export DATABASE_URL_TEST="postgresql://bi:bi@localhost:55432/bi_test"
export VANNA_BASE_URL_TEST="http://localhost:58001"

echo ">> docker compose up -d --build"
docker compose -f docker-compose.test.yml up -d --build

echo ">> esperando readiness"
bash scripts/e2e/wait-for-port.sh localhost 55432 90
bash scripts/e2e/wait-for-port.sh localhost 58001 90

echo ">> migraciones + seed"
DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
if [ -f prisma/seed-catalogo.ts ]; then
    DATABASE_URL="$DATABASE_URL_TEST" npx tsx prisma/seed-catalogo.ts
fi

cat > .env.integration <<EOF
DATABASE_URL=$DATABASE_URL_TEST
DATABASE_URL_REPLICA=$DATABASE_URL_TEST
VANNA_BASE_URL=$VANNA_BASE_URL_TEST
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://100.91.87.86:11435}
INTEGRATION=1
INTEGRATION_TS=$TS
EOF

echo ">> listo · variables en .env.integration"
