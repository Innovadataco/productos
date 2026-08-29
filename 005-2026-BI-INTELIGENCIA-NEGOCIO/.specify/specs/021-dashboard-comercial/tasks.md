# TASKS-021 · Dashboard COMERCIAL

> **Nota de bundle offline (Opción A · 2026-08-29):** YAML declarativos en
> `superset/`. Marco lo cerrado offline; el resto lo cierra Fábrica en VPS.

## F2 · Verificación vocabulario
- [x] `SELECT DISTINCT estado FROM "Subscription"` · anotado upstream (∅ dev · default `'activo'` schema línea 855)
- [x] `SELECT DISTINCT estado FROM "BillingCycle"` · anotado upstream (∅ dev · default `'pendiente'` schema línea 865)
- [x] KPIs consistentes con vocabulario documentado ('activo' · 'pagado' · churn = `<> 'activo'`)

## F3 · Verificación moneda · **VPS**
- [ ] `SELECT min, avg, max, count FROM "BillingCycle" 90d` · anotar
- [ ] Confirmar magnitud COP · si USD → PARA · escalar Fábrica BI-2

## F4 · Charts COMERCIAL (SQLs cita literal del spec.md §Alcance)
- [x] `com_mrr_mes_actual_v1` · Big Number sobre `mv_fact_comercial_mensual` (fuente que el spec pide) · YAML
- [x] `com_mrr_12m_line_v1` · Line 12 meses (parte del KPI 1 · Big Number + Line) · YAML
- [x] `com_nuevas_suscripciones_v1` · Big Number con delta (mes vs anterior) · YAML
- [x] `com_churn_mes_v1` · Big Number · YAML
- [x] `com_distribucion_por_plan_v1` · Pie chart · YAML
- [x] `com_top10_ingresos_colegio_v1` · Bar horizontal COP · YAML
- [x] `com_pagos_no_pagados_30d_v1` · Tabla 4 col · YAML
- [x] Dashboard `Comercial` YAML con 7 charts (KPI 1 = Big Number + Line)
- [x] Export `superset/dashboards/comercial.yaml`

## F5 · Gate local · **VPS**
- [ ] Cruce MRR Superset vs réplica · cero diferencia
- [ ] Cruce MRR vs cierre Jelkin (Fábrica BI-2 valida · anota en research.md)
- [ ] Todos los charts < 3 s

## F6 · Ratchets CI
- [x] 4/5 ratchets local verdes
- [ ] `mv-schema-check.sh` · SKIP en Dev BI-2; Fábrica cierra

## Cierre · **VPS**
- [ ] `cierre.md`
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
