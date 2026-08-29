# SPEC-023 · Dashboard SALUD

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 023 |
| **Nombre** | dashboard-salud |
| **Origen** | BI · INSTRUCTIVO-010 · F3C 2026-08-28 22:34 COT |
| **Brief** | BI · A-02 v1.1 §3.5 |
| **Audiencia** | Fábrica · técnica |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Entregar en Superset el tablero **SALUD** con 8 KPIs sobre la infraestructura BI (réplica · Vanna · Ollama · Superset · pipeline PI). 4 de los 8 KPIs quedan como PLACEHOLDER "sin datos aún" hasta que INSTRUCTIVO-007 (Vanna) e INSTRUCTIVO-008 (bot healthcheck) cierren.

---

## Alcance · 8 KPIs (4 activos · 4 placeholder Fase 1)

| # | KPI | Fuente | Estado Fase 1 | Refresh |
|---|---|---|---|---|
| 1 | Lag réplica (segundos) | `pg_last_xact_replay_timestamp()` | 🟢 activo | 1 min |
| 2 | Consultas Vanna últimas 24h | `bi_consulta_log` (INSTRUCTIVO-006/007) | ⚪ placeholder (sin datos aún) | 15 min |
| 3 | Precisión Vanna primera pasada | `bi_consulta_log` | ⚪ placeholder | 60 min |
| 4 | Errores Superset últimas 24h | Superset metadata DB | 🟢 activo | 30 min |
| 5 | Uptime servicios BI | INSTRUCTIVO-008 healthcheck aggregate | ⚪ placeholder | 5 min |
| 6 | Cache hit rate Vanna (candado 7) | `bi_cache_semantico` (INSTRUCTIVO-006/007) | ⚪ placeholder | 60 min |
| 7 | Reintentos Reporte últimas 24h (fallidos) | `ReintentoReporte` | 🟢 activo | 30 min |
| 8 | Rate limits activados hoy | `RateLimit` | 🟢 activo | 60 min |

### SQL / origen (verificado contra schema PI · candado 15)

**1 · Lag réplica**
```sql
SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::numeric, 2) AS lag_segundos;
```

**2 · Consultas Vanna 24h** — depende de tabla `bi_consulta_log` creada por INSTRUCTIVO-006 (schema Prisma) pero **poblada** por INSTRUCTIVO-007 (Vanna). Query base placeholder:
```sql
SELECT count(*) AS consultas_24h
FROM bi_consulta_log
WHERE "creadoEn" >= NOW() - INTERVAL '24 hours';
```
Superset muestra "0" o "No data" hasta que Vanna emita.

**3 · Precisión Vanna primera pasada** — placeholder. Campos reales de `bi_consulta_log` (schema BI líneas 96-111): `estado` · `sqlGenerado` · `error` · `fuenteCache` · `latenciaMs`. Semántica adoptada: SQL válido ⇔ `estado = 'exitoso' AND error IS NULL`.
```sql
SELECT ROUND(
  100.0 * count(*) FILTER (WHERE estado = 'exitoso' AND error IS NULL)
  / NULLIF(count(*), 0),
  2
) AS precision_pct
FROM bi_consulta_log
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';
```
Si el pipeline Vanna termina requiriendo un booleano `sqlValido` explícito distinto de esta semántica, se abre migración aditiva en spec propia — no se difiere aquí.

**4 · Errores Superset 24h** — vive en la BD metadata `bi-superset-db:5432`, NO en `bi-db-replica`:
```sql
-- Ejecutar contra bi-superset-db (Superset debe registrar esta base como segunda datasource)
SELECT count(*) AS errores_24h
FROM logs
WHERE dttm >= NOW() - INTERVAL '24 hours'
  AND action IN ('log', 'error');
```
Estructura exacta de la tabla `logs` de Superset se confirma en PASO 5 (Superset v3+ usa `logs.action` para eventos; error se marca en `json`).

**5 · Uptime servicios BI** — placeholder hasta INSTRUCTIVO-008.

**6 · Cache hit rate Vanna** — placeholder hasta INSTRUCTIVO-007. Referencia: `bi_cache_semantico` tabla creada por INSTRUCTIVO-006. Campo real en `bi_consulta_log`: `fuenteCache` (Boolean · default `false` · schema BI línea 103; `true` = respondido desde cache semántico).
```sql
SELECT ROUND(
  100.0 * count(*) FILTER (WHERE "fuenteCache" = true)
  / NULLIF(count(*), 0),
  2
) AS cache_hit_pct
FROM bi_consulta_log
WHERE "creadoEn" >= NOW() - INTERVAL '7 days';
```

**7 · Reintentos Reporte 24h fallidos**
```sql
SELECT count(*) AS reintentos_fallidos_24h
FROM "ReintentoReporte"
WHERE "creadoEn" >= NOW() - INTERVAL '24 hours'
  AND exitoso = false;
```

**8 · Rate limits activados hoy** (`RateLimit` línea 2051)
```sql
SELECT scope, SUM(count) AS activaciones
FROM "RateLimit"
WHERE "windowStart" >= date_trunc('day', NOW() AT TIME ZONE 'America/Bogota')
GROUP BY scope
ORDER BY activaciones DESC;
```

---

## Fuera de alcance

- Poblar `bi_consulta_log` desde Vanna (INSTRUCTIVO-007)
- Poblar tabla uptime desde el bot (INSTRUCTIVO-008)
- Envío de alertas cuando `lag_segundos > 30` o `reintentos_fallidos > umbral` (INSTRUCTIVO-008)
- Métricas Ollama por modelo (Fase 2)

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 7 | Cache semántico veredictos humanos | KPI 6 mide su efectividad (placeholder) |
| 9 | Sin datos → "No data" nunca inventa | Superset default respeta · charts placeholder NO fabrican números |
| 12 | Traza completa por consulta | KPI 2, 3, 6 leen la traza |
| 13 | Sanitizer PII | Ningún KPI expone contenido de consultas · solo métricas agregadas |
| 14 | Verde CI ≠ funciona | Fábrica valida en vivo desconectando réplica → lag debe subir |
| 15 | Verificar en fuente | `ReintentoReporte.exitoso` · `RateLimit.scope` · confirmar antes de SQL final |
| 17 | spec+plan commiteado | Aplicado |

---

## Riesgos

- **Segunda datasource en Superset** (metadata DB `bi-superset-db`) para KPI 4 · usuario read-only propio. Documentar en `INVENTARIO-DE-SECRETOS.md`.
- **`bi_consulta_log` puede no existir aún** en la réplica al momento del despliegue si INSTRUCTIVO-006 no cerró en la réplica prod. Charts 2, 3, 6 configurados con "Show No Data" para no romper el dashboard.
- **Tabla `logs` de Superset** cambia de estructura entre versiones — verificar en PASO 5 con la versión desplegada en `Dockerfile.superset`.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
