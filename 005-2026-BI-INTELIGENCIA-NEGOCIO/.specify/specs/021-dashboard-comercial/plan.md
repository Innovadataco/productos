# PLAN-021 · Dashboard COMERCIAL

## Fases

### F1 · Datasets (heredados de SPEC-019)
`Subscription` · `BillingCycle` · `Plan` · `Colegio` · `mv_fact_comercial_mensual` ya importados en SPEC-019 F1.

### F2 · Verificación vocabulario real (candado 15)
```sql
SELECT DISTINCT estado FROM "Subscription";
SELECT DISTINCT estado FROM "BillingCycle";
SELECT DISTINCT estado, count(*) FROM "BillingCycle" GROUP BY estado ORDER BY 2 DESC;
```
Anotar en research.md. Ajustar KPI 1, 3, 5, 6 si los strings reales difieren.

### F3 · Verificación moneda (cruce con Jelkin)
```sql
SELECT MIN(monto), AVG(monto), MAX(monto), COUNT(*)
FROM "BillingCycle"
WHERE "creadoEn" >= NOW() - INTERVAL '90 days';
```
Si magnitud sugiere USD (miles) en vez de COP (millones), PARA y escalar a Fábrica BI-2 antes de mostrar MRR. Brief §3.3 nota fija: "COP formateado con number_format sin decimales".

### F4 · Charts COMERCIAL (6 KPIs)
1. `com_mrr_mes_actual_v1` · Big Number COP + line 12m (mismo chart Superset dual-metric)
2. `com_nuevas_suscripciones_v1` · Big Number con delta %
3. `com_churn_mes_v1` · Big Number
4. `com_distribucion_por_plan_v1` · Pie chart
5. `com_top10_ingresos_colegio_v1` · Bar chart horizontal COP
6. `com_pagos_no_pagados_30d_v1` · Tabla 4 columnas ordenada por fecha DESC

Format COP: `formatter: SI` con sufijo COP o `#,##0` según preferencia de Jelkin (Fábrica confirma en gate local).

Dashboard `Comercial` · export `superset/dashboards/comercial.yaml`.

### F5 · Gate local
- Cruce MRR Superset vs `SELECT SUM(monto) FROM "BillingCycle" WHERE ...` en réplica → cero diferencia.
- Cruce MRR Superset vs cierre financiero mensual de Jelkin → Fábrica BI-2 hace el cruce y anota en research.md (candado 14).
- Cada chart < 3 s.

### F6 · Ratchets CI verdes.

---

## Dependencias

- SPEC-019 F1 (datasets registrados).
- Migración `20260828120100_mv_fact_bi` aplicada (MV `mv_fact_comercial_mensual` disponible).
- Jelkin proporciona su cierre financiero mensual (fuera de esta SPEC · Fábrica coordina).

---

## Artefactos producidos

- `superset/dashboards/comercial.yaml`
- `superset/charts/com_*.yaml` (6 charts)
- Entrada en `DASHBOARDS-CATALOGO.md`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
