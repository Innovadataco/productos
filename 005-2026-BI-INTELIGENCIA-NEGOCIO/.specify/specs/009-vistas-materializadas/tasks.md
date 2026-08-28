# TASKS-009 · 5 vistas materializadas BI

## Estado de tareas

| # | Tarea | Estado |
|---|---|---|
| T-01 | Crear migración con `prisma migrate dev --create-only --name mv_fact_bi` | ⏳ pendiente |
| T-02 | Escribir SQL de las 5 MVs en migration.sql (con COALESCE en NULLables) | ⏳ pendiente |
| T-03 | Agregar `CREATE UNIQUE INDEX` para cada MV (requerido por REFRESH CONCURRENTLY) | ⏳ pendiente |
| T-04 | Aplicar migración con `prisma migrate deploy` | ⏳ pendiente |
| T-05 | Verificar 5 MVs con `\dm mv_fact*` en psql | ⏳ pendiente |
| T-06 | Crear `scripts/refresh-mv.sh` con los 5 REFRESH CONCURRENTLY | ⏳ pendiente |
| T-07 | Crear `docker/mv-refresh/Dockerfile.mv-refresh` (postgres:16-alpine + crond) | ⏳ pendiente |
| T-08 | Agregar servicio `bi-mv-refresh` en docker-compose.bi.yml | ⏳ pendiente |
| T-09 | Verificar healthcheck `pgrep crond` funciona en Alpine | ⏳ pendiente |
| T-10 | Test REFRESH CONCURRENTLY sin bloqueo (SELECT + REFRESH simultáneos) | ⏳ pendiente |
| T-11 | Verificar `tsc --noEmit` sin errores nuevos | ⏳ pendiente |

## Verificación gate local

```bash
# T-05: listar MVs
psql $DATABASE_URL -c "\dm mv_fact*"
# Esperado: 5 vistas materializadas

# T-05: contar filas en primera MV (prueba de que réplica tiene datos)
psql $DATABASE_URL -c "SELECT count(*) FROM mv_fact_reporte_diario;"

# T-10: test REFRESH CONCURRENTLY sin bloqueo
psql $DATABASE_URL -c "SELECT count(*) FROM mv_fact_reporte_diario;" &
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;" \
  && echo "CONCURRENT OK"
wait
```

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
