#!/bin/bash
# scripts/ratchets/mv-schema-check.sh
# Ratchet: valida que las migraciones de vistas materializadas del BI corran
# contra un schema PI real (dump del schema.prisma de PI · aplicado a un
# Postgres efímero pgvector:pg16). Detecta candado 15 (columnas/enums que no
# existen en el schema real) antes de llegar al VPS.
#
# SPEC-009 v2 · F3C 2026-08-28 · Autor: bi-dev-2
# Origen: R-020 (NO CUMPLE 927e7fb7 · 3 MVs con JOINs contra columnas fantasma)
#
# Requiere:
#   - docker corriendo
#   - repo PI en ../002-2026-PROTECCION-INFANTIL con prisma/schema.prisma
#   - node/npm con prisma instalado (usa el prisma local del repo PI)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PI_REPO="$(cd "$REPO_ROOT/../002-2026-PROTECCION-INFANTIL" && pwd)"
MV_MIGRATION="$REPO_ROOT/prisma/migrations/20260828120100_mv_fact_bi/migration.sql"

if [ ! -f "$PI_REPO/prisma/schema.prisma" ]; then
  echo "SKIP · repo PI no encontrado en $PI_REPO (ratchet solo activa en Mac local)"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "SKIP · docker no disponible"
  exit 0
fi

CONTAINER="bi-ratchet-mv-check"
PORT=15499

# Cleanup previo
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Postgres efímero pgvector:pg16 (mismo que producción)
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER=bi_admin \
  -e POSTGRES_PASSWORD=ratchet \
  -e POSTGRES_DB=proteccion_infantil \
  -p "$PORT:5432" \
  pgvector/pgvector:pg16 >/dev/null

# Cleanup automático al salir
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

# Esperar readiness
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" pg_isready -U bi_admin -d proteccion_infantil >/dev/null 2>&1 && break
  sleep 1
done

# 1. Generar schema PI real desde su schema.prisma
PI_SCHEMA_SQL="$(mktemp -t pi_schema_XXXXXX.sql)"
trap 'rm -f "$PI_SCHEMA_SQL"; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT
# Pin explícito a la versión de PI (5.22.0). Sin este pin, `npx prisma` en un
# job de CI sin `npm ci` previo resuelve "latest" del registro npm y puede
# caer en pre-releases rotos (p.ej. 8.0.0-rc.12 cuelga ~60s y sale 2).
(
  cd "$PI_REPO"
  npx --yes prisma@5.22.0 migrate diff \
    --from-empty \
    --to-schema-datamodel prisma/schema.prisma \
    --script > "$PI_SCHEMA_SQL"
)

# 2. Aplicar schema PI al postgres efímero
docker cp "$PI_SCHEMA_SQL" "$CONTAINER:/tmp/pi_schema.sql"
docker exec "$CONTAINER" psql -U bi_admin -d proteccion_infantil -q -v ON_ERROR_STOP=1 -f /tmp/pi_schema.sql >/dev/null

# 3. Aplicar migración de MVs (esta es la validación real)
docker cp "$MV_MIGRATION" "$CONTAINER:/tmp/mv.sql"
if ! docker exec "$CONTAINER" psql -U bi_admin -d proteccion_infantil -v ON_ERROR_STOP=1 -f /tmp/mv.sql >/tmp/mv_out.log 2>&1; then
  echo "❌ ratchet mv-schema-check FAIL · MVs no aplican sobre schema PI real"
  cat /tmp/mv_out.log
  exit 1
fi

# 4. Verificar que las 5 MVs existen
COUNT=$(docker exec "$CONTAINER" psql -U bi_admin -d proteccion_infantil -tAc \
  "SELECT count(*) FROM pg_matviews WHERE matviewname LIKE 'mv_fact_%';")
if [ "$COUNT" != "5" ]; then
  echo "❌ ratchet mv-schema-check FAIL · esperaba 5 MVs · encontró $COUNT"
  exit 1
fi

# 5. REFRESH CONCURRENTLY de las 5
for MV in mv_fact_reporte_diario mv_fact_motor_ia_diario mv_fact_operativo mv_fact_comercial_mensual mv_fact_salud_sistema; do
  if ! docker exec "$CONTAINER" psql -U bi_admin -d proteccion_infantil -v ON_ERROR_STOP=1 \
      -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $MV;" >/dev/null 2>&1; then
    echo "❌ ratchet mv-schema-check FAIL · REFRESH CONCURRENTLY falla en $MV"
    exit 1
  fi
done

echo "✅ ratchet mv-schema-check OK · 5 MVs aplican y refrescan sobre schema PI real"
