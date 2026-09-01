#!/usr/bin/env bash
# ==========================================================================
# Deploy BI v2 (006) a producción — corre SOLO en el clon de despliegue de BI:
#   /opt/proteccion-infantil/bi-repo  (el clon de PI es PROHIBIDO tocarlo)
#
# Estructura S2 del playbook:
#   [1] reset a origin/main → [2] imágenes etiquetadas con el hash →
#   [3] migrate deploy → [4] seed → [5] up → [6] healthcheck →
#   "DEPLOY VERIFICADO: <hash>"
# S1: este script se probó completo antes de mergearse.
# Rollback: BI_VERSION=<hash-anterior> docker compose -f docker-compose.bi.yml up -d
#
# Fase 1b: migrate y seed corren en el servicio one-shot `bi-migrate`
# (profile "tools" · target tools del Dockerfile). La imagen standalone de
# bi-next NO lleva prisma CLI ni tsx: nunca se migra/seedea desde bi-next.
#
# LÍMITES: .env.bi.production lo crea y toca SOLO Jelkin. Este script solo
# opera recursos bi-* del producto 006; contenedores de PI: ni mirarlos.
# ==========================================================================
set -euo pipefail

REPO_DIR="${BI_REPO_DIR:-/opt/proteccion-infantil/bi-repo}"
APP_DIR="$REPO_DIR/006-2026-BI-INTELIGENCIA-NEGOCIO"
COMPOSE="docker compose -f docker-compose.bi.yml"
PUERTO="${BI_PORT:-3001}"

echo "== [1/6] Reset del clon a origin/main =="
cd "$REPO_DIR"
git fetch origin main
git checkout main
git reset --hard origin/main

HASH="$(git rev-parse --short HEAD)"
export BI_VERSION="$HASH"
echo "    versión a desplegar: $HASH"

cd "$APP_DIR"
if [ ! -f .env.bi.production ]; then
    echo "FALLO: falta .env.bi.production (lo crea Jelkin con permisos 600)" >&2
    exit 1
fi

echo "== [2/6] Build de imágenes bi-006-next:$HASH y bi-006-tools:$HASH =="
# Con --profile tools también construye bi-migrate (target tools); comparten
# cache del stage deps, así que el costo extra es mínimo.
$COMPOSE --profile tools build

echo "== [3/6] Migraciones (aditivas, prisma migrate deploy) =="
# Servicio one-shot bi-migrate: depends_on espera a bi-db healthy (la levanta
# si aún no corre). Sin condicionales: si falla, se falla EN VOZ ALTA (B2).
$COMPOSE --profile tools run --rm bi-migrate

echo "== [4/6] Seed (idempotente, upsert con update vacío — S3) =="
# Mismo servicio tools; el comando sobreescribe el CMD por defecto.
$COMPOSE --profile tools run --rm bi-migrate npx prisma db seed

echo "== [5/6] Levantando stack =="
$COMPOSE up -d

echo "== [6/6] Healthcheck de bi-next =="
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
curl -fsS "http://127.0.0.1:${PUERTO}/api/bi/estado-sistema" > /dev/null

echo "DEPLOY VERIFICADO: $HASH"
echo "Pendiente humano (P1/P2): abrir la app en el navegador y recorrer el flujo real."
