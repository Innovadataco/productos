# SPEC-021 · Dashboard COMERCIAL

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 021 |
| **Nombre** | dashboard-comercial |
| **Origen** | BI · INSTRUCTIVO-010 · F3C 2026-08-28 22:34 COT |
| **Brief** | BI · A-02 v1.1 §3.3 |
| **Audiencia** | Jelkin (ADMIN) · uso diario |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Entregar en Superset el tablero **COMERCIAL** con 6 KPIs sobre conversión, ingresos y retención. Formato COP sin decimales.

---

## Alcance · 6 KPIs

| # | KPI | Fuente | Visualización | Refresh |
|---|---|---|---|---|
| 1 | MRR mes actual + línea 12 meses | `mv_fact_comercial_mensual` | Big Number + Line 12 meses | 60 min |
| 2 | Nuevas suscripciones mes vs anterior | `Subscription` | Big Number con delta % | 60 min |
| 3 | Churn mes actual | `Subscription` | Big Number | 60 min |
| 4 | Distribución por plan | `Subscription` × `Plan` | Pie chart | 60 min |
| 5 | Top 10 colegios (ingresos mes) | `BillingCycle` × `Subscription` × `Colegio` | Bar chart horizontal | 60 min |
| 6 | Pagos con estado ≠ 'pagado' (30d) | `BillingCycle` | Tabla 4 col | 60 min |

### SQL base (candado 15 · verificar `SELECT DISTINCT estado` en PASO 5)

**1 · MRR mes actual + línea 12 meses** (usa MV creada por INSTRUCTIVO-006)
```sql
-- Big Number MRR mes actual
SELECT COALESCE(SUM(monto_total), 0) AS mrr_cop
FROM mv_fact_comercial_mensual
WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
  AND ciclo_estado = 'pagado';

-- Line chart 12 meses
SELECT mes, SUM(monto_total) AS mrr_cop
FROM mv_fact_comercial_mensual
WHERE mes >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') - INTERVAL '11 months'
  AND ciclo_estado = 'pagado'
GROUP BY mes
ORDER BY mes;
```

**2 · Nuevas suscripciones mes vs anterior**
```sql
WITH por_mes AS (
  SELECT date_trunc('month', "creadoEn" AT TIME ZONE 'America/Bogota') AS mes,
         count(*) AS nuevas
  FROM "Subscription"
  WHERE "creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') - INTERVAL '1 month'
  GROUP BY mes
)
SELECT mes, nuevas
FROM por_mes
ORDER BY mes;
```
Superset calcula el delta % con Time Comparison nativo.

**3 · Churn mes actual** (vocabulario a confirmar: 'cancelado' / 'inactivo' / etc en PASO 5)
```sql
SELECT count(*) AS churn_mes
FROM "Subscription"
WHERE estado <> 'activo'
  AND "creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota');
```

**4 · Distribución por plan**
```sql
SELECT p.nombre AS plan, count(s.id) AS suscripciones
FROM "Subscription" s
JOIN "Plan" p ON p.id = s."planId"
WHERE s.estado = 'activo'
GROUP BY p.nombre
ORDER BY suscripciones DESC;
```

**5 · Top 10 colegios ingresos mes** (solo `Colegio.nombre` público)
```sql
SELECT c.nombre AS colegio, SUM(bc.monto) AS ingresos_cop
FROM "BillingCycle" bc
JOIN "Subscription" s ON s.id = bc."subscriptionId"
JOIN "Colegio"      c ON c."tenantId" = s."tenantId"
WHERE bc."creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
  AND bc.estado = 'pagado'
GROUP BY c.nombre
ORDER BY ingresos_cop DESC
LIMIT 10;
```

**6 · Pagos con estado ≠ 'pagado' (30 días)**
```sql
SELECT bc.id, bc.estado, bc.monto, bc."creadoEn", bc."periodoInicio"
FROM "BillingCycle" bc
WHERE bc.estado <> 'pagado'
  AND bc."creadoEn" >= NOW() - INTERVAL '30 days'
ORDER BY bc."creadoEn" DESC
LIMIT 200;
```

---

## Fuera de alcance

- Módulo pagos completo `Suscripcion` (mayúscula · enum EstadoSuscripcion · línea 875) → SPEC futura si Jelkin pide vista integral post-Fase 1
- Alertas Slack/Telegram sobre churn (INSTRUCTIVO-008)
- Multi-tenant row-level (Fase 2)

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 9 | Sin datos → "No data" | Superset default |
| 13 | Sanitizer PII | KPI 5 solo `Colegio.nombre` público · NO representante legal |
| 14 | Verificación en vivo | Cruce MRR vs cierre financiero mensual Jelkin (Fábrica valida centavo por centavo) |
| 15 | Verificar en fuente | `SELECT DISTINCT estado` obligatorio en PASO 5 para `Subscription` y `BillingCycle` |
| 17 | spec+plan commiteado | Aplicado |

---

## Riesgos

- **Vocabulario `estado`** en `Subscription`/`BillingCycle` diferente al asumido → SQL 1, 3, 5, 6 se ajusta en PASO 5 tras `SELECT DISTINCT`.
- **`Suscripcion` vs `Subscription`** (línea 875 vs 851 schema PI) son **dos tablas distintas**. Este dashboard usa `Subscription` minimalista (tenant-based) + `BillingCycle`. La tabla `Suscripcion` completa del módulo de pagos (`EstadoSuscripcion` enum · contratoPDFUrl · etc.) NO se usa aquí — declarado como fuera de alcance.
- **MRR sin conversión USD→COP**: `BillingCycle.monto` está en `Float` sin marca de moneda. El brief asume ya-en-COP. Fábrica valida con Jelkin al cerrar SPEC.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
