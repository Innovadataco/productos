# SPEC-019 · Dashboard EJECUTIVO

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 019 |
| **Nombre** | dashboard-ejecutivo |
| **Origen** | BI · INSTRUCTIVO-010 · F3C 2026-08-28 22:34 COT |
| **Brief** | BI · A-02 v1.1 (dashboards Superset MVP · §3.1) |
| **Audiencia** | Jelkin (ADMIN · dueño) · uso diario |
| **Estado** | ⏳ spec+plan LISTO · implementación pendiente (REVISO) |

---

## Objetivo

Entregar en Superset el tablero **EJECUTIVO** con 6 KPIs que le den a Jelkin la foto operativa del negocio en 30 segundos. Fuente única: `bi-db-replica` vía usuario read-only `bi_reader`.

---

## Alcance · 6 KPIs

| # | KPI | Fuente | Visualización | Refresh |
|---|---|---|---|---|
| 1 | Reportes últimas 24h | tabla `Reporte` | Big Number con delta vs 24h previas | 5 min |
| 2 | Suscripciones activas | tabla `Subscription` | Big Number con delta semanal | 15 min |
| 3 | MRR mes actual (COP) | tabla `BillingCycle` | Big Number COP | 15 min |
| 4 | Casos de prioridad alta abiertos | tabla `Reporte` | Big Number rojo si >0 | 5 min |
| 5 | Tendencia reportes últimos 30 días | MV `mv_fact_reporte_diario` | Line chart | 15 min |
| 6 | Top 5 colegios por volumen mes | `Reporte` × `Colegio` | Bar chart horizontal | 60 min |

### SQL base (verificado contra `schema.prisma` PI · candado 15)

**1 · Reportes últimas 24h**
```sql
SELECT count(*) AS total
FROM "Reporte"
WHERE "creadoEn" >= NOW() - INTERVAL '24 hours'
  AND "eliminado" = false;
```

**2 · Suscripciones activas** (vocabulario libre · reconfirmar `SELECT DISTINCT estado` en PASO 5)
```sql
SELECT count(*) AS activas
FROM "Subscription"
WHERE estado = 'activo';
```

**3 · MRR mes actual** (vocabulario 'pagado' declarado en brief · reconfirmar en PASO 5)
```sql
SELECT COALESCE(SUM(monto), 0) AS mrr_cop
FROM "BillingCycle"
WHERE "creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
  AND estado = 'pagado';
```

**4 · Prioridad alta abiertos** (enum `EstadoReporte` verificado línea 470-479 schema PI)
```sql
SELECT count(*) AS abiertos
FROM "Reporte"
WHERE "prioridadAlta" = true
  AND estado NOT IN ('CLASIFICADO', 'CORREGIDO')
  AND "eliminado" = false;
```

**5 · Tendencia 30 días** (usa MV creada por INSTRUCTIVO-006)
```sql
SELECT dia, SUM(total_reportes) AS reportes
FROM mv_fact_reporte_diario
WHERE dia >= NOW() - INTERVAL '30 days'
GROUP BY dia
ORDER BY dia;
```

**6 · Top 5 colegios mes** (solo `Colegio.nombre` público · nada de representante legal · candado 13)
```sql
SELECT c.nombre AS colegio, count(r.id) AS reportes
FROM "Reporte" r
JOIN "Colegio" c ON c."tenantId" = r."tenantId"
WHERE r."creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
  AND r."eliminado" = false
GROUP BY c.nombre
ORDER BY reportes DESC
LIMIT 5;
```

---

## Fuera de alcance

- Chat NL-to-SQL (SPEC-011..014 · INSTRUCTIVO-007)
- Alertas Telegram basadas en umbrales (INSTRUCTIVO-008)
- Row-level security multi-tenant runtime (Fase 2)
- Módulos comerciales colegio/padre en PI (Fase 2/3)
- Export PDF/CSV con marca IDC (Fase 3 · Superset nativo Fase 1)

---

## Candados aplicables

| # | Candado | Aplicación en este SPEC |
|---|---|---|
| 9 | Sin datos → "No data" nunca inventa | Superset default respeta · valida "0" vs vacío |
| 11 | Guard tenancy | Fase 1 solo ADMIN (Jelkin+Fábrica) · row-level Fase 2 |
| 13 | Sanitizer PII antes de responder | GRANT columna a columna · KPI 6 solo `Colegio.nombre` público |
| 14 | Verde CI ≠ funciona · verificación en vivo | Cruce KPI 1 vs pi-db master · cruce MRR con cierre Jelkin |
| 15 | Verificar en fuente · nunca suponer | `Subscription.estado` y `BillingCycle.estado` son String libres · SELECT DISTINCT obligatorio en PASO 5 |
| 17 | spec+plan commiteado antes de implementar | Este documento + plan.md pusheado antes de código |
| 20 | Réplica sin PII cruda | `bi_reader` NO tiene GRANT sobre columnas PII |

---

## Riesgos

- **Vocabulario libre** de `Subscription.estado` / `BillingCycle.estado` divergente del asumido → mitigación: `SELECT DISTINCT` obligatorio en PASO 5 antes de escribir SQL final.
- **`Colegio.tenantId`** puede ser null en reportes anónimos · `JOIN` puede dejar registros huérfanos → KPI 6 usa `INNER JOIN` explícito para descartar reportes sin colegio identificado.
- **Timezone America/Bogota** obligatorio en `date_trunc('month', ...)` para evitar bug de medianoche (D-69 PI).

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 (Desarrollo BI) |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
