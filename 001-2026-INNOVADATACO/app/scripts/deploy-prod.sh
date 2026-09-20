#!/usr/bin/env bash
# Deploy de Innovadataco Admin (001) a producción.
# Uso (en el VPS): cd /opt/innovadataco/repo/001-2026-INNOVADATACO/app
#   ./scripts/deploy-prod.sh
# Rollback: IDC_ADMIN_TAG=<sha-anterior> ./scripts/deploy-prod.sh --skip-pull
set -euo pipefail
cd "$(dirname "$0")/.."

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

if [[ "${1:-}" != "--skip-pull" ]]; then
    COMMIT_ANTES=$(git rev-parse HEAD)
    git fetch origin main
    COMMIT_REMOTO=$(git rev-parse origin/main)
    if [ "$COMMIT_ANTES" = "$COMMIT_REMOTO" ]; then
        echo "==> Ya estás en la punta de main ($COMMIT_ANTES)."
    else
        echo "==> Actualizando local $COMMIT_ANTES → remoto $COMMIT_REMOTO"
        git reset --hard origin/main
    fi
fi

export IDC_ADMIN_TAG="$(git rev-parse --short HEAD)"
export APP_BUILD_SHA="${IDC_ADMIN_TAG}"
echo "==> Build idc-admin:${IDC_ADMIN_TAG}"
BUILD_START=$(date +%s)
$COMPOSE build
BUILD_END=$(date +%s)
BUILD_SECONDS=$((BUILD_END - BUILD_START))
docker tag "idc-admin:${IDC_ADMIN_TAG}" idc-admin:latest

echo "==> Build tardó ${BUILD_SECONDS}s"
if [ "$BUILD_SECONDS" -gt 720 ]; then
    echo "❌ FAIL: build tardó ${BUILD_SECONDS}s (> 8 min)"
    exit 1
fi
if [ "$BUILD_SECONDS" -gt 480 ]; then
    echo "⚠️  WARN: build tardó ${BUILD_SECONDS}s (> 5 min)"
fi

echo "==> Up"
$COMPOSE up -d

echo "==> Healthcheck"
sleep 5
curl -sf http://127.0.0.1:5001/login && echo "  <- app OK"

COMMIT_DESPUES=$(git rev-parse HEAD)
IMAGEN=$(docker inspect idc-admin-app --format '{{.Config.Image}}' 2>/dev/null || echo "unknown")
echo ""
echo "================================================================"
echo "  DEPLOY VERIFICADO"
echo "  Commit desplegado: $COMMIT_DESPUES"
echo "  Imagen contenedor: $IMAGEN"
echo "================================================================"
if ! echo "$IMAGEN" | grep -q "$(echo "$COMMIT_DESPUES" | cut -c1-8)"; then
    echo "🚨 ALERTA: imagen $IMAGEN NO coincide con commit $COMMIT_DESPUES"
    exit 1
fi

# Limpiar worktrees > 7 días.
git worktree list | awk 'NR>1 {print $1}' | while read wt; do
    if [ -d "$wt" ] && [ "$(( ($(date +%s) - $(stat -c %Y "$wt" 2>/dev/null || stat -f %m "$wt" 2>/dev/null || echo 0)) / 86400 ))" -gt 7 ]; then
        echo "🗑  Eliminando worktree viejo: $wt"
        git worktree remove --force "$wt" 2>/dev/null || true
    fi
done
git worktree prune

echo "==> Listo. Tag desplegado: ${IDC_ADMIN_TAG}"
