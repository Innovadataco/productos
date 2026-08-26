#!/usr/bin/env bash
# Deploy de PI a producción (spec 097-US7).
# Uso (en el VPS): cd /opt/proteccion-infantil/repo/002-2026-PROTECCION-INFANTIL
#   ./scripts/deploy-prod.sh
# Rollback (spec 097-US8): PI_APP_TAG=<sha-anterior> ./scripts/deploy-prod.sh --skip-pull
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

if [[ "${1:-}" != "--skip-pull" ]]; then
    echo "==> git pull (feature/001-scaffolding)"
    git pull --ff-only origin feature/001-scaffolding
fi

export PI_APP_TAG="$(git rev-parse --short HEAD)"
# Sello de versión (spec 102): el mismo SHA se hornea en la imagen vía build-arg.
export APP_BUILD_SHA="${PI_APP_TAG}"
echo "==> Build pi-app:${PI_APP_TAG}"
$COMPOSE build
docker tag "pi-app:${PI_APP_TAG}" pi-app:latest

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
echo "==> Listo. Tag desplegado: ${PI_APP_TAG}"
