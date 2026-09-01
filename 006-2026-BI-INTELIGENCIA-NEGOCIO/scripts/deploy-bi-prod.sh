#!/usr/bin/env bash
# ==========================================================================
# Deploy BI v2 (006) a producción — SOLO lo ejecuta Jelkin (bloqueado para IA).
# Estructura S2 del playbook:
#   fetch + reset a origin/rama → imagen etiquetada con el hash → up →
#   healthcheck → "DEPLOY VERIFICADO: <hash>"
# Rollback: BI_VERSION=<hash-anterior> docker compose -f docker-compose.bi.yml up -d
# ==========================================================================
set -euo pipefail

RAMA="work/bi-SPEC-006-bi-v2"
REPO_DIR="/opt/proteccion-infantil/bi-repo"
APP_DIR="$REPO_DIR/006-2026-BI-INTELIGENCIA-NEGOCIO"

echo "== Actualizando clon a origin/$RAMA =="
cd "$REPO_DIR"
git fetch origin "$RAMA"
git checkout "$RAMA"
git reset --hard "origin/$RAMA"

HASH="$(git rev-parse --short HEAD)"
export BI_VERSION="$HASH"

cd "$APP_DIR"
if [ ! -f .env.bi.production ]; then
    echo "FALLO: falta .env.bi.production (lo crea Jelkin con permisos 600)" >&2
    exit 1
fi

echo "== Construyendo imagen bi-006-next:$HASH =="
docker compose -f docker-compose.bi.yml build

echo "== Levantando stack =="
docker compose -f docker-compose.bi.yml up -d

echo "== Esperando healthcheck de bi-next =="
estado="desconocido"
for _ in $(seq 1 30); do
    estado="$(docker inspect --format '{{.State.Health.Status}}' bi-next 2>/dev/null || echo desconocido)"
    [ "$estado" = "healthy" ] && break
    sleep 2
done
if [ "$estado" != "healthy" ]; then
    echo "FALLO: bi-next no quedó healthy (estado: $estado)" >&2
    docker logs bi-next --tail 50 >&2
    exit 1
fi

curl -fsS http://127.0.0.1:3001/api/bi/estado-sistema > /dev/null

echo "DEPLOY VERIFICADO: $HASH"
echo "Verificación manual obligatoria (P1/P2): abrir https://bi.innovadataco.com,"
echo "probar login con el admin y recorrer /dashboard, /chat y /operacion."
