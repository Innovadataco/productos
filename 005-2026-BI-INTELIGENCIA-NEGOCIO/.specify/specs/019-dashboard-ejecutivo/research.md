# RESEARCH-019 · Dashboard EJECUTIVO

## Verificación de vocabulario (candado 15)

**Estado a la hora del spec+plan:** verificación diferida al PASO 5 (implementación). En este punto no hay conexión operativa a `bi-db-replica` desde el clone del CEO/Dev; las credenciales `bi_reader` viven en `.env.bi.production` fuera de git (`INVENTARIO-DE-SECRETOS.md`). El vocabulario libre se re-confirmará contra la réplica antes de guardar cada chart de Superset.

### Valores esperados desde `schema.prisma` PI (fuente autoritativa)

| Campo | Tipo | Default | Valores esperados |
|---|---|---|---|
| `Reporte.estado` | enum `EstadoReporte` | `PENDIENTE` | PENDIENTE · PROCESANDO · CLASIFICADO · REVISION_MANUAL · POSIBLE_SPAM · DUPLICADO · REQUIERE_ANONIMIZACION · CORREGIDO (líneas 470-479) |
| `Subscription.estado` | String libre | `"activo"` | brief §3.3 asume 'activo' como estado abierto único · resto = churn |
| `BillingCycle.estado` | String libre | `"pendiente"` | brief §3.1 asume 'pagado' para MRR · otros: 'pendiente' · 'rechazado' |
| `Colegio.estado` | String libre | `"activo"` | brief no filtra por este campo · dashboard EJECUTIVO no lo usa |
| `Reporte.prioridadAlta` | Boolean | `false` | usado como flag para KPI 4 |
| `Reporte.eliminado` | Boolean | `false` | filtro estándar en todas las queries |

### Valores REALES anotados (rellenar en PASO 5)

```
-- $ psql -h bi-db-replica -U bi_reader -d proteccion_infantil
--
-- SELECT DISTINCT estado FROM "Reporte";
-- resultado: [pendiente al ejecutar]
--
-- SELECT DISTINCT estado FROM "Subscription";
-- resultado: [pendiente]
--
-- SELECT DISTINCT estado FROM "BillingCycle";
-- resultado: [pendiente]
```

Si un valor real difiere del brief (por ejemplo `'PAGADO'` en mayúsculas donde brief asume `'pagado'`), se ajusta el SQL del chart antes de commitear al PR.

---

## Decisiones de diseño

### D-019.1 · Timezone explícito
Todas las queries con `date_trunc('month', ...)` o `date_trunc('day', ...)` para agrupar deben calcular la ventana en `America/Bogota`: `date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')`. Origen: D-69 PI (bug de medianoche por TZ ausente).

### D-019.2 · KPI 6 (Top 5 colegios) usa `INNER JOIN`
Reportes anónimos pueden tener `Reporte.tenantId = NULL`. Un `LEFT JOIN` sacaría bucket "sin colegio". Preferimos `INNER JOIN` para que Top 5 muestre solo colegios identificados. Nota: Jelkin valida en PASO 5 si prefiere ver también volumen anónimo por separado.

### D-019.3 · Delta comparativo
KPIs 1, 2, 3, 4 usan la comparación nativa Big Number de Superset (Time Comparison). Ventana comparativa:
- KPI 1: 24 h anteriores
- KPI 2: 7 días anteriores
- KPI 3: mismo día del mes anterior
- KPI 4: 24 h anteriores

### D-019.4 · MRR solo desde `BillingCycle`
El brief §3.1 y §3.3 usan `BillingCycle` como fuente de MRR (ciclos con estado `'pagado'` en el mes actual). NO se cruza con el modelo `Suscripcion` (mayúscula distinta · módulo de pagos completo con `EstadoSuscripcion` enum) porque no es la fuente autoritativa de facturación mensual. El nombre correcto es `Subscription` minúscula → `BillingCycle.subscriptionId` → `Plan`.

### D-019.5 · GRANT PII revocado (candado 20)
`bi_reader` NO debe tener SELECT sobre columnas PII. Si al verificar en F2 se encuentra que sí las tiene, PARA y escalar a Fábrica BI-2 antes de continuar con la implementación.

---

## Fuentes consultadas

- `productos/002-2026-PROTECCION-INFANTIL/prisma/schema.prisma` (44 modelos · 1113 líneas · leído secciones Reporte 1609-1685 · Subscription 851-859 · BillingCycle 861-869 · Colegio 1055-1105 · enum EstadoReporte 470-479)
- `productos/005-.../prisma/migrations/20260828120100_mv_fact_bi/migration.sql` (MV `mv_fact_reporte_diario` líneas 14-35)
- `BRIEF-A-02-DASHBOARDS-SUPERSET-MVP.md` v1.1 §3.1 (queries base)
- `BI · INSTRUCTIVO-010 · dashboards-superset-mvp.md` (PASO 2 · vocabulario · PASO 5 · GRANT PII)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
