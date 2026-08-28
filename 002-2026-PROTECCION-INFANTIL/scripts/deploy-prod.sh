#!/usr/bin/env bash
# Deploy de PI a producción (spec 097-US7).
# Uso (en el VPS): cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL
#   ./scripts/deploy-prod.sh
# Rollback (spec 097-US8): PI_APP_TAG=<sha-anterior> ./scripts/deploy-prod.sh --skip-pull
set -euo pipefail
cd "$(dirname "$0")/.."

# SPEC-294 (002-PI-195): BuildKit obligatorio para respetar `RUN --mount=type=cache`
# del Dockerfile (npm ci cache mount, prisma consolidado). Compose-plugin ya lo usa
# por default; docker-compose classic (v1/v2 legacy) requiere estas dos vars.
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

export PI_APP_TAG="$(git rev-parse --short HEAD)"
# Sello de versión (spec 102): el mismo SHA se hornea en la imagen vía build-arg.
export APP_BUILD_SHA="${PI_APP_TAG}"
echo "==> Build pi-app:${PI_APP_TAG}"
BUILD_START=$(date +%s)
$COMPOSE build
BUILD_END=$(date +%s)
BUILD_SECONDS="${PI_BUILD_SECONDS_OVERRIDE:-$((BUILD_END - BUILD_START))}"
docker tag "pi-app:${PI_APP_TAG}" pi-app:latest

# SPEC-294 (002-PI-195): ratchet contra regresión del tiempo de build.
# Umbrales del brief §4: warn > 480s (5min), fail > 720s (8min).
# PI_BUILD_SECONDS_OVERRIDE permite testear el ratchet sin construir realmente.
echo "==> Build tardó ${BUILD_SECONDS}s"
if [ "$BUILD_SECONDS" -gt 720 ]; then
    echo "❌ FAIL: build tardó ${BUILD_SECONDS}s (> 8 min · umbral duro SPEC-294)"
    exit 1
fi
if [ "$BUILD_SECONDS" -gt 480 ]; then
    echo "⚠️  WARN: build tardó ${BUILD_SECONDS}s (> 5 min · umbral blando SPEC-294)"
fi

echo "==> Up (app + worker + db)"
$COMPOSE up -d

echo "==> Migraciones (aditivas)"
$COMPOSE exec -T app npx prisma migrate deploy

# SPEC-251 (002-PI-154 · I-49): guardián de índices — verifica los 5 índices críticos
# justo después de aplicar migraciones. Si falta algún índice o el tipo no coincide,
# el deploy para aquí con error. NO hace rollback automático — el CEO decide.
echo "==> Guardián de índices (SPEC-251)"
$COMPOSE exec -T app npm run indices:check

# 002-PI-085 (I-67): seed idempotente de parámetros y catálogos. Respeta los
# valores custom del CEO (update: {} por defecto; solo los parámetros cuyo
# default cambió por decisión de una SPEC usan update explícito, documentado).
echo "==> Seed idempotente (params + catálogos, respeta valor custom si existe)"
$COMPOSE exec -T app node --import tsx prisma/seed.ts

# 002-PI-048: propagar módulos/grants nuevos a la BD existente (aditivo e
# idempotente: crea faltantes, nunca revoca). Evita que un módulo nuevo quede
# invisible por grants sembrados antes de su spec (clase I-39/D-43).
# Nota: el seed también llama a syncModulosYGrants(), por lo que este paso es
# redundante pero conservado como garantía explícita en el deploy.
echo "==> Sync módulos/grants (aditivo)"
$COMPOSE exec -T app node --import tsx scripts/sync-modulos-grants.ts

# 002-PI-051 (B1): el buscador de ciudades filtra por nombreNormalizado; si la BD
# es pre-SPEC-115 (campo vacío) o el catálogo es mínimo, importar GeoNames
# (idempotente; no-op rápido cuando está sana).
echo "==> Catálogo geográfico (importa solo si falta)"
$COMPOSE exec -T app node --import tsx scripts/geo-import-si-falta.ts

echo "==> Healthcheck"
sleep 5
curl -sf http://127.0.0.1:5005/api/health/worker && echo "  <- app+worker OK"

# A-47 (candado 4): verificar que la imagen desplegada coincide con el commit.
COMMIT_DESPUES=$(git rev-parse HEAD)
IMAGEN=$(docker inspect pi-app --format '{{.Config.Image}}' 2>/dev/null || echo "unknown")
echo ""
echo "================================================================"
echo "  DEPLOY VERIFICADO"
echo "  Commit desplegado: $COMMIT_DESPUES"
echo "  Imagen contenedor: $IMAGEN"
echo "================================================================"
if ! echo "$IMAGEN" | grep -q "$(echo "$COMMIT_DESPUES" | cut -c1-8)"; then
    echo "🚨 ALERTA: imagen $IMAGEN NO coincide con commit $COMMIT_DESPUES"
    echo "   El deploy puede haber reusado imagen vieja. Verificar manualmente."
    exit 1
fi

# A-47 (candado 6): limpiar worktrees > 7 días.
git worktree list | awk 'NR>1 {print $1}' | while read wt; do
    if [ -d "$wt" ] && [ "$(( ($(date +%s) - $(stat -c %Y "$wt" 2>/dev/null || stat -f %m "$wt" 2>/dev/null || echo 0)) / 86400 ))" -gt 7 ]; then
        echo "🗑  Eliminando worktree viejo: $wt"
        git worktree remove --force "$wt" 2>/dev/null || true
    fi
done
git worktree prune

echo "==> Listo. Tag desplegado: ${PI_APP_TAG}"
