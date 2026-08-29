# RESEARCH-023 · Dashboard SALUD

## Estructura verificada contra `schema.prisma` PI

### `ReintentoReporte` (líneas 1739-1751)
```
id · reporteId · intento (Int) · exitoso (Boolean default false) · error (Text?) · creadoEn
```
KPI 7 filtra `exitoso = false AND "creadoEn" >= NOW() - 24h`.

### `RateLimit` (líneas 2051-2061)
```
key (id) · scope · identifier · windowStart · count · createdAt · actualizadoEn
```
KPI 8 agrupa `scope` y suma `count` sobre `windowStart >= date_trunc('day', NOW() TZ Bogota)`.

### `bi_consulta_log` (creado por INSTRUCTIVO-006 · pendiente verificación estructura)
Diferido a PASO 5. La spec SPEC-007 declaró 6 modelos incluyendo `BIConsultaLog`. Nombres de columnas exactos (`sqlValido`, `hit`, etc.) se verifican al leer `prisma/schema.prisma` local.

---

## Tabla `logs` de Apache Superset

La metadata DB de Superset (v3+) tiene una tabla `logs` con columnas típicas:
- `id` · `action` (ej. 'log', 'sql_json') · `user_id` · `dttm` · `json` (payload) · `dashboard_id` · `slice_id`

Errores del navegador y de SQL Lab se registran con `action IN ('log', 'error')` y el detalle en `json`. Se re-confirma en PASO 5 con `\d public.logs` contra la instancia desplegada.

---

## Decisiones de diseño

### D-023.1 · Placeholders NO fabrican datos (candado 9)
Los charts 2, 3, 5, 6 se configuran en Superset con la opción "Show No Data Alert" activada. Si la query retorna 0 filas, el chart muestra el mensaje "No data" (o "sin datos aún") y no un "0" que se lea como métrica real.

### D-023.2 · KPI 1 usa dataset SQL Lab virtual
`pg_last_xact_replay_timestamp()` es una función administrativa. Superset admite datasets virtuales (SQL Lab dataset saved as source) con `SELECT ...`. Nombre canónico `bi_lag_replica_virtual`.

### D-023.3 · KPI 4 requiere segunda datasource
La metadata DB de Superset (`bi-superset-db:5432`) es una BD distinta de `bi-db-replica:5432`. Necesita segunda conexión con usuario `superset_reader` propio. Documentar en `INVENTARIO-DE-SECRETOS.md`.

### D-023.4 · Timezone en KPI 8
`date_trunc('day', NOW() AT TIME ZONE 'America/Bogota')` para que un rate limit activado a las 11 pm cuente en el día correcto.

### D-023.5 · Umbral lag 30 s
Big Number del KPI 1 con colorización:
- ≤ 10 s → verde
- 10-30 s → amarillo
- > 30 s → rojo (dispara futura alerta en INSTRUCTIVO-008)

---

## Placeholders y su activación futura

| KPI | Activación |
|---|---|
| 2, 3, 6 | Cuando INSTRUCTIVO-007 (Vanna) empiece a poblar `bi_consulta_log` |
| 5 | Cuando INSTRUCTIVO-008 (bot Telegram + healthcheck aggregate) cierre |

En PASO 5, al implementar, se documenta en `cierre.md` cuáles KPIs quedan "sin datos aún" y cuál INSTRUCTIVO los activa.

---

## Fuentes consultadas

- `schema.prisma` PI · ReintentoReporte 1739-1751 · RateLimit 2051-2061
- SPEC-007 `.specify/specs/007-schema-prisma-bi/spec.md` (declaración de `BIConsultaLog`)
- BRIEF-A-02 v1.1 §3.5 (8 KPIs · nota sobre 4 placeholders)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
