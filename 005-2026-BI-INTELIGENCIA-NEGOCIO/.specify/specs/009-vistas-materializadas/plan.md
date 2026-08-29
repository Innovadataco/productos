# PLAN-009 · 5 vistas materializadas BI

## Pre-requisito

SPEC-007 CUMPLE · réplica pg_logical activa con datos de PI.

## Pasos de implementación

### Paso 1 · Crear migración SQL manual para las MVs

```bash
npx prisma migrate dev --name "mv_fact_bi" --create-only
```

Editar el SQL generado en `prisma/migrations/YYYYMMDDHHMMSS_mv_fact_bi/migration.sql`.

### Paso 2 · Contenido de `migration.sql`

```sql
-- Extensión vector (idempotente)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── mv_fact_reporte_diario ────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_reporte_diario AS
SELECT
  date_trunc('day', r."creadoEn")                           AS dia,
  r.pais,
  r.ciudad,
  r.estado::text                                            AS estado,
  COALESCE(c.categoria::text, 'SIN_CLASIFICAR')             AS categoria,
  r."prioridadAlta",
  r."esRafaga",
  r."esAnonimo",
  count(*)                                                  AS total_reportes,
  count(c.id)                                               AS total_clasificados,
  count(ca.id)                                              AS total_corregidos,
  avg(c."confianza")                                        AS confianza_promedio,
  avg(c."latenciaMs")                                       AS latencia_ms_promedio
FROM "Reporte" r
LEFT JOIN "ClasificacionIA" c ON c."reporteId" = r.id
LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId" = r.id
WHERE r."eliminado" = false
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

CREATE UNIQUE INDEX idx_mv_fact_reporte_diario
  ON mv_fact_reporte_diario (dia, pais, ciudad, estado, categoria, "prioridadAlta", "esRafaga", "esAnonimo");

-- ── mv_fact_motor_ia_diario ────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_motor_ia_diario AS
SELECT
  date_trunc('day', c."creadoEn")                           AS dia,
  COALESCE(c.categoria::text, 'SIN_CLASIFICAR')             AS categoria,
  COALESCE(c."modeloUsado", 'desconocido')                  AS modelo,
  count(*)                                                  AS total,
  count(ca.id)                                              AS total_corregidos,
  avg(c."confianza")                                        AS confianza_promedio,
  avg(c."latenciaMs")                                       AS latencia_ms_promedio
FROM "ClasificacionIA" c
LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId" = c."reporteId"
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_fact_motor_ia_diario
  ON mv_fact_motor_ia_diario (dia, categoria, modelo);

-- ── mv_fact_operativo ─────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_operativo AS
SELECT
  date_trunc('day', t."creadoEn")                           AS dia,
  t."estadoAnterior"::text                                  AS estado_anterior,
  t."estadoNuevo"::text                                     AS estado_nuevo,
  t."responsableTipo"::text                                 AS responsable_tipo,
  count(*)                                                  AS total_transiciones,
  count(sc.id)                                              AS total_solicitudes_comite
FROM "TransicionReporte" t
LEFT JOIN "SolicitudComite" sc
  ON sc."reporteId" = t."reporteId"
  AND date_trunc('day', sc."creadoEn") = date_trunc('day', t."creadoEn")
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_mv_fact_operativo
  ON mv_fact_operativo (dia, estado_anterior, estado_nuevo, responsable_tipo);

-- ── mv_fact_comercial_mensual ────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_comercial_mensual AS
SELECT
  date_trunc('month', bc."periodoInicio")                   AS mes,
  COALESCE(p.nombre, 'desconocido')                         AS plan_nombre,
  COALESCE(bc.estado, 'desconocido')                        AS ciclo_estado,
  count(*)                                                  AS total_ciclos,
  sum(bc.monto)                                             AS monto_total,
  avg(bc.monto)                                             AS monto_promedio
FROM "BillingCycle" bc
LEFT JOIN "Subscription" s ON s."tenantId" = bc."tenantId"
LEFT JOIN "Plan" p ON p.id = s."planId"
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_fact_comercial_mensual
  ON mv_fact_comercial_mensual (mes, plan_nombre, ciclo_estado);

-- ── mv_fact_salud_sistema ─────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_fact_salud_sistema AS
SELECT
  date_trunc('day', al."creadoEn")                          AS dia,
  COALESCE(al.accion, 'desconocida')                        AS accion,
  count(*)                                                  AS total_eventos_audit,
  count(ace.id)                                             AS total_alertas_colegio,
  count(ase.id)                                             AS total_alertas_suscripcion
FROM "AuditLog" al
LEFT JOIN "AlertaColegio" ace
  ON date_trunc('day', ace."creadoEn") = date_trunc('day', al."creadoEn")
LEFT JOIN "AlertaSuscripcion" ase
  ON date_trunc('day', ase."creadoEn") = date_trunc('day', al."creadoEn")
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_mv_fact_salud_sistema
  ON mv_fact_salud_sistema (dia, accion);
```

### Paso 3 · Aplicar migración

```bash
npx prisma migrate deploy
```

Verificar que las 5 MVs existen:
```bash
psql $DATABASE_URL -c "\dm mv_fact*"
# Debe listar las 5 vistas materializadas
```

### Paso 4 · Crear script `scripts/refresh-mv.sh`

```bash
#!/bin/sh
# refresh-mv.sh · Desarrollado para bi-mv-refresh (Alpine crond)
# Corre cada 10 min. Variables de entorno: PGHOST PGUSER PGPASSWORD PGDATABASE
set -e

psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;"
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_motor_ia_diario;"
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_operativo;"
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_comercial_mensual;"
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_salud_sistema;"

echo "$(date -u) · refresh OK"
```

```bash
chmod +x scripts/refresh-mv.sh
```

### Paso 5 · Crear `docker/mv-refresh/Dockerfile.mv-refresh`

```dockerfile
FROM postgres:16-alpine
RUN echo '*/10 * * * * /usr/local/bin/refresh-mv.sh >> /var/log/refresh-mv.log 2>&1' \
  > /etc/crontabs/root
CMD ["crond", "-f", "-l", "2"]
```

### Paso 6 · Agregar servicio `bi-mv-refresh` en `docker-compose.bi.yml`

```yaml
bi-mv-refresh:
  build:
    context: .
    dockerfile: docker/mv-refresh/Dockerfile.mv-refresh
  volumes:
    - ./scripts/refresh-mv.sh:/usr/local/bin/refresh-mv.sh:ro
  environment:
    PGHOST: bi-db-replica
    PGUSER: ${REPLICA_DB_USER}
    PGPASSWORD: ${REPLICA_DB_PASSWORD}
    PGDATABASE: ${REPLICA_DB_NAME}
  networks:
    - bi-net
  depends_on:
    bi-db-replica:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "pgrep", "crond"]
    interval: 60s
    timeout: 5s
    retries: 3
  restart: unless-stopped
```

### Paso 7 · Verificar REFRESH CONCURRENTLY sin bloqueo

```bash
# Test: SELECT concurrente + REFRESH simultáneo
psql $DATABASE_URL -c "SELECT count(*) FROM mv_fact_reporte_diario;" &
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;"
wait
echo "Test CONCURRENT OK"
```

---

## Árbol de archivos resultante

```
prisma/migrations/YYYYMMDDHHMMSS_mv_fact_bi/
└── migration.sql              (NUEVO · 5 MVs + 5 UNIQUE INDEX)
scripts/
└── refresh-mv.sh              (NUEVO · ejecutado por bi-mv-refresh)
docker/mv-refresh/
└── Dockerfile.mv-refresh      (NUEVO · postgres:16-alpine + crond)
docker-compose.bi.yml          (modificado · servicio bi-mv-refresh añadido)
```

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
