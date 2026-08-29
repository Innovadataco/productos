# TASKS-021 · Dashboard COMERCIAL

## F2 · Verificación vocabulario
- [ ] `SELECT DISTINCT estado FROM "Subscription"` · anotar
- [ ] `SELECT DISTINCT estado, count(*) FROM "BillingCycle" GROUP BY estado` · anotar
- [ ] Ajustar KPI 1/3/5/6 si vocabulario difiere del brief

## F3 · Verificación moneda
- [ ] `SELECT min, avg, max, count FROM "BillingCycle" 90d` · anotar
- [ ] Confirmar magnitud COP · si USD → PARA · escalar Fábrica BI-2

## F4 · Charts COMERCIAL
- [ ] `com_mrr_mes_actual_v1` · Big Number + Line 12m
- [ ] `com_nuevas_suscripciones_v1` · Big Number delta %
- [ ] `com_churn_mes_v1` · Big Number
- [ ] `com_distribucion_por_plan_v1` · Pie chart
- [ ] `com_top10_ingresos_colegio_v1` · Bar horizontal COP
- [ ] `com_pagos_no_pagados_30d_v1` · Tabla 4 col
- [ ] Dashboard `Comercial` creado · 6 charts
- [ ] Export `superset/dashboards/comercial.yaml`

## F5 · Gate local
- [ ] Cruce MRR Superset vs réplica · cero diferencia
- [ ] Cruce MRR vs cierre Jelkin (Fábrica BI-2 valida · anota en research.md)
- [ ] Todos los charts < 3 s

## F6 · Ratchets CI
- [ ] `run-all.sh` verde

## Cierre
- [ ] `cierre.md`
- [ ] Entrada en `DASHBOARDS-CATALOGO.md`
