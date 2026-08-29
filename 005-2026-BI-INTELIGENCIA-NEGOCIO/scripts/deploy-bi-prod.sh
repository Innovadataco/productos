#!/bin/bash
# deploy-bi-prod.sh · BI Inteligencia de Negocio
# Solo Jelkin ejecuta este script desde su terminal (bloqueado para IA por classifier)
# Pre-requisito: PR ya mergeado a main (git push ya hecho antes de ejecutar)
# F3C: 2026-08-29 · A-47 Etapa 2 (candado 4: verificación commit+imagen · candado 6: worktrees)
# Reemplaza la versión SPEC-002 (2026-08-28) que aún apuntaba a feature/bi-scaffolding
# (rama eliminada por la migración A-47 · ver DIRECTRIZ-009 BI · D-009)

set -e

BI_REPO_PATH="/opt/proteccion-infantil/bi-repo/005-2026-BI-INTELIGENCIA-NEGOCIO"
COMPOSE_FILE="docker-compose.bi.yml"
ENV_FILE=".env.bi.production"
BRANCH="main"

echo "🚀 Deploy BI iniciando..."

# A-47 (candado 6): limpiar worktrees BI > 7 días en el Mac Studio (local, no en el VPS).
if [ -d "$(dirname "$0")/../../.worktrees" ]; then
    (
        cd "$(dirname "$0")/../.."
        git worktree list 2>/dev/null | awk 'NR>1 {print $1}' | grep '\.worktrees/bi-' | while read -r wt; do
            if [ -d "$wt" ] && [ "$(( ($(date +%s) - $(stat -f %m "$wt" 2>/dev/null || stat -c %Y "$wt" 2>/dev/null || echo 0)) / 86400 ))" -gt 7 ]; then
                echo "🗑  Eliminando worktree BI viejo: $wt"
                git worktree remove --force "$wt" 2>/dev/null || true
            fi
        done
        git worktree prune
    )
fi

ssh pi-vps << REMOTE
set -e
cd ${BI_REPO_PATH}

echo "📥 Actualizando código..."
COMMIT_ANTES=\$(git rev-parse HEAD)
git fetch origin ${BRANCH}
COMMIT_REMOTO=\$(git rev-parse origin/${BRANCH})
if [ "\$COMMIT_ANTES" = "\$COMMIT_REMOTO" ]; then
    echo "==> Ya estás en la punta de ${BRANCH} (\$COMMIT_ANTES)."
else
    echo "==> Actualizando local \$COMMIT_ANTES → remoto \$COMMIT_REMOTO"
    git reset --hard origin/${BRANCH}
fi

export BI_APP_TAG="\$(git rev-parse --short HEAD)"

echo "🔨 Build bi-next:\${BI_APP_TAG}..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-next

echo "🔨 Build bi-vanna..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-vanna

echo "🔨 Build bi-telegram..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build bi-telegram

echo "⬆️  Levantando servicios..."
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d

echo "==> Migraciones (aditivas)"
# Pin explícito (mismo bug I-09 de mv-schema-check.sh): npx sin pin resuelve
# "latest" del registro npm (hoy prisma@8.0.0-rc.12, roto) en vez del devDependency
# instalado en el build. Versión BI real: package.json -> devDependencies.prisma.
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T bi-next npx --yes prisma@6.19.3 migrate deploy

echo "==> Seed idempotente (catálogo BI)"
# "seed" vive en package.json bajo la clave "prisma" (convención de Prisma para
# `prisma db seed`), NO bajo "scripts" — "npm run seed" nunca existió. I-16.
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T bi-next npx --yes prisma@6.19.3 db seed

echo "==> Guardián de índices"
docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} exec -T bi-next node scripts/verificar-indices-post-migrate.mjs

echo "⏳ Esperando healthchecks (30s)..."
sleep 30

echo "🏥 Verificando BI..."
curl -f http://127.0.0.1:3001/api/health || (echo "❌ bi-next unhealthy" && exit 1)
curl -f http://127.0.0.1:8001/health      || (echo "❌ bi-vanna unhealthy" && exit 1)
curl -f http://127.0.0.1:8088/health     || (echo "❌ bi-superset unhealthy" && exit 1)

# A-47 (candado 4): verificar que la imagen desplegada coincide con el commit.
COMMIT_DESPUES=\$(git rev-parse HEAD)
IMAGEN=\$(docker inspect bi-next --format '{{.Config.Image}}' 2>/dev/null || echo "unknown")
echo ""
echo "================================================================"
echo "  DEPLOY VERIFICADO"
echo "  Commit desplegado: \$COMMIT_DESPUES"
echo "  Imagen contenedor: \$IMAGEN"
echo "================================================================"
if ! echo "\$IMAGEN" | grep -q "\$(echo "\$COMMIT_DESPUES" | cut -c1-8)"; then
    echo "🚨 ALERTA: imagen \$IMAGEN NO coincide con commit \$COMMIT_DESPUES"
    echo "   El deploy puede haber reusado imagen vieja. Verificar manualmente."
    exit 1
fi

echo "✅ Deploy BI OK"
docker compose -f ${COMPOSE_FILE} ps
REMOTE

echo "✅ Deploy completo desde local"
