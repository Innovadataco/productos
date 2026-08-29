# RESEARCH-021 · Dashboard COMERCIAL

## Vocabulario real esperado (candado 15)

**Ejecutado** contra `002-2026-proteccion-infantil-db-1` (misma columna/tipo que la réplica BI). F3C observación: 2026-08-29 00:0x COT. Re-consulta en PASO 5 sobre `bi-db-replica` cuando esté arriba.

```
$ docker exec 002-2026-proteccion-infantil-db-1 \
    psql -U proteccion -d proteccion_infantil -Atc "SELECT DISTINCT estado FROM <tabla>;"

-- Subscription     (0 filas) → ∅  · default schema línea 855 = 'activo'
-- BillingCycle     (0 filas) → ∅  · default schema línea 865 = 'pendiente'
```

**Nota de muestra baja:** el módulo comercial no tiene volumen en dev. Los defaults del schema (`'activo'` y `'pendiente'`) son autoritativos porque la app los usa en INSERT. El vocabulario adicional (`'pagado'`, `'rechazado'`, `'cancelado'`) se re-confirma en PASO 5 sobre datos productivos de la réplica; si aparece un valor no anticipado, se ajusta el SQL del chart y se documenta aquí antes de mergear.

---

## Diferenciación de modelos: `Subscription` vs `Suscripcion`

Este es un hallazgo crítico del schema PI que el dashboard debe respetar:

| Aspecto | `Subscription` (línea 851) | `Suscripcion` (línea 875) |
|---|---|---|
| Estado | `String @default("activo")` | `EstadoSuscripcion` enum |
| Titular | `tenantId` genérico | `colegioId` / `usuarioId` explícito |
| Duración | `iniciaEn` / `terminaEn` | `fechaInicio` / `fechaFin` / `fechaCorteProgramado` |
| Metadatos | mínimo | contratoPDFUrl · esFreemium · monedaLocal · paisCliente · trazabilidad de origen |
| Uso Fase 1 | dashboard COMERCIAL (§3.3 brief) | módulo de pagos completo (SPEC-210 PI · 002-PI-110) |

**Decisión (D-021.1):** dashboard COMERCIAL usa **`Subscription`** minimalista + `BillingCycle` porque:
1. El brief §3.3 explícitamente cita `Subscription`.
2. `BillingCycle.subscriptionId` apunta a `Subscription.id` (no a `Suscripcion.id`).
3. La MV `mv_fact_comercial_mensual` (migración `20260828120100_mv_fact_bi`) hace `JOIN "Subscription" s ON s.id = bc."subscriptionId"` — la MV ya toma la decisión.

Vista integral del módulo de pagos (`Suscripcion` con contrato · pago manual · origen) queda fuera de alcance; si Jelkin pide en Fase 1.5, sale como SPEC nueva.

---

## Cruce MRR

**Plan de validación de KPI 1 (candado 14):**
1. Ejecutar en réplica: `SELECT SUM(monto) FROM "BillingCycle" WHERE "creadoEn" >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') AND estado = 'pagado';`
2. Compararlo con el número mostrado por Superset — deben coincidir (cero diferencia).
3. Fábrica BI-2 solicita a Jelkin su cierre financiero del mes en curso y valida centavo por centavo contra Superset.
4. Si diferencia > 0 COP → investigar (¿estados adicionales cuentan como pagado? ¿zona horaria del `creadoEn`?) · abrir I-XX en gestión.

Resultado del cruce (rellenar en PASO 5):
```
-- Superset MRR mes:         [pendiente COP]
-- Réplica SUM(monto):        [pendiente COP]
-- Cierre Jelkin:             [pendiente COP]
-- Diferencia:                [pendiente]
```

---

## Decisiones de diseño

### D-021.1 · Usar `Subscription`, no `Suscripcion`
Ver arriba. Documenta que este dashboard es sobre el modelo minimalista tenant-based; el módulo de pagos completo es fuera de alcance.

### D-021.2 · Format COP
`number_format = '#,##0'` sin decimales · locale es-CO en Superset. Placeholder de moneda visible en el título del chart (`(COP)`).

### D-021.3 · Timezone en agregaciones mensuales
Todas las queries usan `date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')` para que un pago hecho el 30 a las 11 pm en Colombia cuente en ese mes.

### D-021.4 · Churn simplificado en Fase 1
KPI 3 cuenta suscripciones con estado ≠ 'activo' creadas en el mes actual. Es una definición gruesa (no distingue cancelaciones voluntarias vs suspensiones). Fase 2 evolucionará al modelo `Suscripcion` con `motivoCancelacion` y `canceladaPorUsuario`.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
