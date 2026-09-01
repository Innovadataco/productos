#!/usr/bin/env bash
# ==========================================================================
# refresh-mv.sh · Producto 006 · Refresco periódico de las vistas
# materializadas mv_fact_* (REFRESH CONCURRENTLY — los índices únicos que
# habilitan CONCURRENTLY los crea scripts/replica-setup/05-mv-fact.sql · D-26).
# Lo programa el cron del VPS (ver docs de operación); NUNCA usar el script
# 05 para refrescos de rutina (su REFRESH es el inicial).
# ==========================================================================
set -euo pipefail

ENV_FILE="${BI_ENV_FILE:-/opt/proteccion-infantil/bi-repo/006-2026-BI-INTELIGENCIA-NEGOCIO/.env.bi.production}"
set -a; source "$ENV_FILE"; set +a

for MV in mv_fact_reporte_diario mv_fact_operativo mv_fact_comercial_mensual mv_fact_motor_ia_diario mv_fact_salud_sistema; do
    docker exec bi-db psql -U "$REPLICA_DB_USER" -d "$REPLICA_DB_NAME" \
        -c "REFRESH MATERIALIZED VIEW CONCURRENTLY $MV;" > /dev/null
    echo "[$(date -Is)] $MV refrescada"
done
