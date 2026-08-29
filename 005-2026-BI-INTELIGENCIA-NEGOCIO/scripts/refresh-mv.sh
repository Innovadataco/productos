#!/bin/sh
# refresh-mv.sh · Refresh de las 5 vistas materializadas BI
# SPEC-009 · F3C 2026-08-28 · Autor: bi-dev-2
# Ejecutado por bi-mv-refresh (Alpine crond) cada 10 minutos.
# Requiere variables: PGHOST PGUSER PGPASSWORD PGDATABASE
set -e

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) · $1"; }

log "refresh-mv start"
psql -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;"
psql -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_motor_ia_diario;"
psql -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_operativo;"
psql -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_comercial_mensual;"
psql -v ON_ERROR_STOP=1 -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_salud_sistema;"
log "refresh-mv OK"
