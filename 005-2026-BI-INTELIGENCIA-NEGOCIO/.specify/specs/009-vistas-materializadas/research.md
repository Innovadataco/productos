# RESEARCH-009 · Vistas materializadas BI

## Hallazgo Fase C · JOINs contra schema PI (candado 15) · 2026-08-28

**Origen:** R-020 · NO CUMPLE sobre commit `927e7fb7`. Fábrica BI-2 aplicó `prisma migrate deploy` en VPS y la 2ª migración falló con `ERROR: column ca.reporteId does not exist`. Gate local previo no lo detectó porque se corrió contra stubs manuales de PI, no contra el schema real generado desde `002-2026-PROTECCION-INFANTIL/prisma/schema.prisma`.

**Causa raíz:** 3 JOINs asumieron nombres de columnas que NO existen en el schema PI real:

| MV | JOIN escrito (bug) | Realidad schema PI | Fix aplicado |
|---|---|---|---|
| mv_fact_reporte_diario | `LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId" = r.id` | `CorreccionAdmin` no tiene `reporteId`; solo `clasificacionId @unique` | `ca."clasificacionId" = c.id` |
| mv_fact_motor_ia_diario | `LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId" = c."reporteId"` | idem | `ca."clasificacionId" = c.id` |
| mv_fact_comercial_mensual | `LEFT JOIN "Subscription" s ON s."tenantId" = bc."tenantId"` | `BillingCycle` no tiene `tenantId`; solo `subscriptionId` | `s.id = bc."subscriptionId"` |

**Bonus (detectado por el ratchet nuevo):** `AuditLog.accion` es enum `AccionAudit`, no `String`. `COALESCE(al.accion, 'desconocida')` viola el enum. Fix: `COALESCE(al.accion::text, 'desconocida')`.

**Contramedida sistemática (candado 14 aplicado):** ratchet `scripts/ratchets/mv-schema-check.sh` que:
1. Levanta `pgvector/pgvector:pg16` efímero (mismo image de producción).
2. Aplica el schema PI **real** (dump generado con `prisma migrate diff` desde `002-2026-PROTECCION-INFANTIL/prisma/schema.prisma`).
3. Aplica la migración de MVs contra ese schema.
4. Verifica que las 5 MVs se creen y refresquen con `REFRESH CONCURRENTLY`.

El ratchet se incorpora a `scripts/ratchets/run-all.sh` y corre en `npm run ratchets:check`.

---



## D-25 · pg_cron no disponible en pgvector:pg16 alpine

**Investigación:**

`pg_cron` es una extensión PostgreSQL que requiere compilación con el código fuente de postgres y no está incluida en la imagen `pgvector/pgvector:pg16`. Para añadirla habría que construir una imagen custom con el source de pg_cron compilado — complejidad injustificada.

**Alternativa adoptada:** contenedor `bi-mv-refresh` separado basado en `postgres:16-alpine` que incluye `psql` y Alpine `crond`. El script `refresh-mv.sh` corre cada 10 minutos y ejecuta los 5 REFRESH CONCURRENTLY. Healthcheck `CMD pgrep crond` verifica que el daemon está activo.

---

## D-26 · REFRESH CONCURRENTLY requiere UNIQUE INDEX en columnas NOT NULL

**Problema:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requiere exactamente un `UNIQUE INDEX` sobre la MV. Si alguna columna del índice puede ser NULL, la unicidad falla (PostgreSQL 16 tiene `NULLS NOT DISTINCT` pero solo en índices, no en MVs con REFRESH CONCURRENTLY en todos los backends).

**Solución adoptada:** usar `COALESCE(columna_nullable, 'valor_default')` en la definición de la MV para garantizar NOT NULL en las columnas del índice:

```sql
COALESCE(c.categoria::text, 'SIN_CLASIFICAR') AS categoria,
COALESCE(c."modeloUsado", 'desconocido')      AS modelo,
```

Esto garantiza que el UNIQUE INDEX nunca tiene NULLs y REFRESH CONCURRENTLY funciona sin error.

---

## Decisión sobre granularidad de índices UNIQUE

Cada MV tiene un único índice UNIQUE que cubre TODAS las columnas de granularidad (GROUP BY). Esto asegura que cada fila es única y que REFRESH CONCURRENTLY puede funcionar:

| MV | Columnas del UNIQUE INDEX |
|---|---|
| mv_fact_reporte_diario | dia, pais, ciudad, estado, categoria, prioridadAlta, esRafaga, esAnonimo |
| mv_fact_motor_ia_diario | dia, categoria, modelo |
| mv_fact_operativo | dia, estado_anterior, estado_nuevo, responsable_tipo |
| mv_fact_comercial_mensual | mes, plan_nombre, ciclo_estado |
| mv_fact_salud_sistema | dia, accion |

---

## Timing del refresh

`*/10 * * * *` = cada 10 minutos. Impacto en réplica: los REFRESH son lectura intensiva sobre las tablas replicadas de PI (read-only). No generan escrituras en las tablas PI. El lag de la réplica pg_logical + el refresh de 10 min = máximo 10 min de desfase en los dashboards Superset.

---

## Test REFRESH CONCURRENTLY sin bloqueo (candado 14)

```bash
# Test: SELECT concurrente mientras corre REFRESH
psql $DATABASE_URL -c "SELECT pg_sleep(3), count(*) FROM mv_fact_reporte_diario;" &
PID=$!
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fact_reporte_diario;"
REFRESH_EXIT=$?
wait $PID
SELECT_EXIT=$?
[ $REFRESH_EXIT -eq 0 ] && [ $SELECT_EXIT -eq 0 ] && echo "CONCURRENT OK" || echo "FALLO"
```

Si el REFRESH bloquea al SELECT → el índice UNIQUE está mal definido (tiene NULLs) → revisar COALESCE.

---

## Tablas fuente verificadas (candado 15)

| MV | Tablas PI replicadas | Campos usados | Verificado |
|---|---|---|---|
| mv_fact_reporte_diario | Reporte · ClasificacionIA · CorreccionAdmin | creadoEn · pais · ciudad · estado · prioridadAlta · esRafaga · esAnonimo · eliminado · categoria · confianza · latenciaMs | ✅ 2026-08-28 |
| mv_fact_motor_ia_diario | ClasificacionIA · CorreccionAdmin | creadoEn · categoria · modeloUsado · confianza · latenciaMs | ✅ 2026-08-28 |
| mv_fact_operativo | TransicionReporte · SolicitudComite | creadoEn · estadoAnterior · estadoNuevo · responsableTipo · reporteId | ✅ 2026-08-28 |
| mv_fact_comercial_mensual | BillingCycle · Subscription · Plan · Tenant | periodoInicio · monto · estado · planId · nombre (Plan) | ✅ 2026-08-28 |
| mv_fact_salud_sistema | AuditLog · AlertaColegio · AlertaSuscripcion | creadoEn · accion | ✅ 2026-08-28 |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
