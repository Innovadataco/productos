# SPEC-009 · 5 vistas materializadas BI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 009 |
| **Nombre** | vistas-materializadas |
| **Origen** | BI · INSTRUCTIVO-006 · F3C 2026-08-28 COT |
| **Brief** | BI · A-04 §3.3 |
| **Estado** | ⏳ spec+plan listo · implementación pendiente (REVISO) |
| **Depende de** | SPEC-007 CUMPLE (Prisma en repo) · réplica pg_logical con datos |

---

## Objetivo

Crear 5 vistas materializadas SQL en `bi-db-replica` sobre tablas replicadas de PI. Cada MV tiene un índice UNIQUE para permitir `REFRESH CONCURRENTLY`. El refresh corre cada 10 minutos vía contenedor `bi-mv-refresh` (Alpine + cron).

---

## Las 5 vistas materializadas

| Vista | Fuente principal | Granularidad | Uso Superset |
|---|---|---|---|
| `mv_fact_reporte_diario` | Reporte + ClasificacionIA + CorreccionAdmin | Por día · categoría · estado · geografía | Dashboard Ejecutivo + Motor IA |
| `mv_fact_motor_ia_diario` | ClasificacionIA + CorreccionAdmin | Por día · modelo · categoría | Dashboard Motor IA |
| `mv_fact_operativo` | TransicionReporte + SolicitudComite | Por responsable · estado | Dashboard Operativo |
| `mv_fact_comercial_mensual` | BillingCycle + Subscription + Plan + Tenant | Por mes · plan | Dashboard Comercial |
| `mv_fact_salud_sistema` | AuditLog + AlertaColegio + AlertaSuscripcion | Por día · tipo acción | Dashboard Salud |

### Decisión D-25 · pg_cron no disponible en pgvector/pgvector:pg16 alpine

`pg_cron` no es una extensión incluida en la imagen `pgvector/pgvector:pg16`. Alternativa adoptada: **contenedor `bi-mv-refresh`** nuevo en `docker-compose.bi.yml` basado en imagen `postgres:16-alpine` que ejecuta el script `scripts/refresh-mv.sh` vía Alpine `crond` cada 10 minutos.

```yaml
bi-mv-refresh:
  image: postgres:16-alpine
  volumes:
    - ./scripts/refresh-mv.sh:/usr/local/bin/refresh-mv.sh:ro
  environment:
    PGHOST: bi-db-replica
    PGUSER: ${REPLICA_DB_USER}
    PGPASSWORD: ${REPLICA_DB_PASSWORD}
    PGDATABASE: ${REPLICA_DB_NAME}
  networks: [bi-net]
  depends_on:
    bi-db-replica:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "pgrep", "crond"]
    interval: 60s
    retries: 3
  restart: unless-stopped
```

### Decisión D-26 · REFRESH CONCURRENTLY + NULLS NOT DISTINCT

`REFRESH CONCURRENTLY` requiere `UNIQUE INDEX`. Columnas de las MVs que pueden ser NULL (e.g., `c.categoria` cuando no hay ClasificacionIA aún): se usa `COALESCE(c.categoria::text, 'SIN_CLASIFICAR')` en la definición de la vista para garantizar NOT NULL en la columna del índice.

### Migración SQL

La migración va en `prisma/migrations/YYYYMMDDHHMMSS_mv_fact/migration.sql`. Incluye:
1. `CREATE EXTENSION IF NOT EXISTS vector;` (idempotente)
2. `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_*`
3. `CREATE UNIQUE INDEX` en cada MV

### Test integración refresh CONCURRENTLY

```bash
# Lanzar SELECT en background · luego REFRESH · verificar que no bloquea
psql ... -c "SELECT pg_sleep(5) FROM mv_fact_reporte_diario LIMIT 1;" &
psql ... -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;"
wait
# Si REFRESH termina sin error y SELECT también termina → test pass
```

---

## Fuera de alcance

- Schema Prisma (SPEC-007)
- Seed (SPEC-008)
- CLI (SPEC-010)
- Dashboards Superset (BRIEF-A-02)

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 15 · Verificar en fuente | Nombres de campos en SQL verificados contra schema PI |
| 14 · Verde en CI ≠ funciona | Test refresh CONCURRENTLY obligatorio en VPS (Jelkin) |
| Healthcheck obligatorio | bi-mv-refresh con `pgrep crond` |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan · REVISO pendiente |
