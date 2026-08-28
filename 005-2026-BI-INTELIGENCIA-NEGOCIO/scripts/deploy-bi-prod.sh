#!/bin/bash
# deploy-bi-prod.sh · BI Inteligencia de Negocio
# Solo Jelkin ejecuta este script desde su terminal (bloqueado para IA por classifier)
# Pre-requisito: git push ya hecho antes de ejecutar
# F3C: 2026-08-28 · SPEC-002

set -e

BI_REPO_PATH="/opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO"
COMPOSE_FILE="docker-compose.bi.yml"
ENV_FILE=".env.bi.production"
BRANCH="feature/bi-scaffolding"

echo "🚀 Deploy BI iniciando..."

ssh pi-vps << REMOTE
set -e
cd ${BI_REPO_PATH}

echo "📥 Actualizando código..."
git fetch origin ${BRANCH}
git reset --hard origin/${BRANCH}

echo "🔨 Build bi-next..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-next

echo "🔨 Build bi-vanna..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-vanna

echo "🔨 Build bi-telegram..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-telegram

echo "⬆️  Levantando servicios..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d

echo "⏳ Esperando healthchecks (30s)..."
sleep 30

echo "🏥 Verificando BI..."
curl -f http://127.0.0.1:3001/api/health || (echo "❌ bi-next unhealthy" && exit 1)
curl -f http://127.0.0.1:8001/health      || (echo "❌ bi-vanna unhealthy" && exit 1)
curl -f http://127.0.0.1:8088/health     || (echo "❌ bi-superset unhealthy" && exit 1)

echo "✅ Deploy BI OK"
docker compose -f ${COMPOSE_FILE} ps
REMOTE

echo "✅ Deploy completo desde local"
