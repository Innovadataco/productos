# RESEARCH-025 · Widget KPIs live

## Columnas reales verificadas (candado 15)

Contra `prisma/migrations/20260828120100_mv_fact_bi/migration.sql` de este mismo repo (SOLO LECTURA · confirmado a 2026-08-29 21:0x COT).

### `mv_fact_reporte_diario`
```
dia · pais · ciudad · estado · categoria · prioridad_alta · es_rafaga · es_anonimo ·
total_reportes · total_clasificados · total_corregidos · confianza_promedio · latencia_ms_promedio
```
- **Usado por KPI 1**: `SUM(total_reportes) WHERE dia >= NOW() - INTERVAL '24 hours'`.
- Verificado que la columna se llama `total_reportes` (no `reportes` ni `reportes_diarios`).

### `mv_fact_motor_ia_diario`
```
dia · categoria · modelo · total · total_corregidos · confianza_promedio · latencia_ms_promedio
```
- No se usa en los 6 KPIs de este SPEC (aparece en SPEC-027 estado sistema, no aquí).

### `mv_fact_operativo`
```
dia · estado_anterior · estado_nuevo · responsable_tipo · total_transiciones · total_solicitudes_comite
```
- No se usa en los 6 KPIs de este SPEC.

### `mv_fact_comercial_mensual`
```
mes · plan_nombre · ciclo_estado · total_ciclos · monto_total · monto_promedio
```
- **Usado por KPI 5**: `SUM(monto_total) WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') AND ciclo_estado = 'pagado'`.
- Verificado que la columna se llama `monto_total` (no `mrr` ni `total_facturado`).

### `mv_fact_salud_sistema`
```
dia · accion · total_eventos_audit · total_alertas_colegio · total_alertas_suscripcion
```
- **Usado por KPI 2**: `SUM(total_alertas_colegio + total_alertas_suscripcion) WHERE dia >= NOW() - 7d`.
- Verificado que no existe `lag_segundos` ni `reintentos_fallidos` (el spec `023` original asumía nombres inventados que fueron corregidos en fix I-19).

### Tablas replicadas PI (candado 15 · verificar upstream)

- **`"Colegio"`** — Tabla replicada por pg_logical a `bi-db-replica` (D-002 · scaffolding réplica).
  - **KPI 3**: `SELECT count(*) FROM "Colegio" WHERE estado = 'activo'`.
  - Vocabulario `estado` verificado en SPEC-019 research: `'activo'` es el único valor observado.

- **`"Subscription"`** — Tabla replicada por pg_logical (schema PI línea 851, default `estado='activo'`).
  - **KPI 4**: `SELECT count(*) FROM "Subscription" WHERE estado = 'activo'`.
  - Vocabulario `estado` documentado en SPEC-019/021 research: `'activo'` es el default; churn = `<> 'activo'`.

---

## Endpoints de healthcheck confirmados

### bi-next `GET /api/health`
Ya existe: `src/app/api/health/route.ts` devuelve `{status: "ok"}`. **No se modifica**.

### bi-vanna `GET ${VANNA_API_URL}/health`
Ya existe: `docker/vanna/main.py` líneas 67-96. Response:
```json
{"ok": bool, "service": "bi-vanna", "modelosDisponibles": [...],
 "modelosConfigurados": [...], "ollamaLatMs": int}
```
Este SPEC solo consume `ok` y mide latencia total del fetch (no la latencia interna Ollama, que es info adicional).

### pi-app `GET ${PI_BASE_URL}/api/health`
Documentado en `.env.bi.example` con `PI_BASE_URL=https://pi.innovadataco.com`. Asumido existente en PI (patrón estándar Next.js). Si no responde en 3 s, el chip pi-app se marca error sin romper el widget (candado 9 + independencia por servicio).

---

## Decisiones de diseño

### D-025.1 · Cada KPI aislado por `safeQuery`
Si la MV está vacía o una query lanza excepción (permiso denegado, tabla ausente), solo ese KPI aparece como "sin datos aún". El endpoint responde 200 con los otros 5 KPIs. Alternativa (endpoint 500 si una query falla) haría que la UI muestre error total → peor UX.

### D-025.2 · `valor: 0` se interpreta como `null` (candado 9)
Cuando `SUM(total_reportes)` sobre 0 filas devuelve 0 (por el `COALESCE`), es indistinguible de "hay filas pero suman 0". Ambos casos son "sin datos operativos" para el usuario. Simplificación aceptable en Fase 1.5; Fase 2 puede agregar un flag `sinFilas` explícito si es necesario distinguir.

### D-025.3 · Uptime bi-next es `self · always OK`
El propio endpoint `/api/bi/kpis` corre en bi-next; si el request llega hasta acá, bi-next está up. Hardcodear `{ok: true, latMs: 0}` es más honesto que hacer un fetch a `/api/health` desde el mismo servidor.

### D-025.4 · Sin auto-refresh
El widget hace un fetch al montar y ya. Fase 2 puede agregar SWR o polling cada 60 s. Ahora la simpleza gana; Jelkin recarga la página si quiere refrescar.

### D-025.5 · Cache-Control: no-store
KPIs son live. Ningún caché intermedio debería servir datos viejos.

---

## Fuentes consultadas

- `prisma/migrations/20260828120100_mv_fact_bi/migration.sql` (5 MVs · líneas 12-108)
- `prisma/schema.prisma` (SPEC-007 · 6 modelos catálogo BI)
- `../002-2026-PROTECCION-INFANTIL/prisma/schema.prisma` (Colegio · Subscription · BillingCycle)
- `src/lib/prisma.ts` (singleton)
- `src/lib/auth/sesion.ts` (guardia · SOLO LECTURA)
- `src/app/api/health/route.ts` (health self)
- `docker/vanna/main.py` líneas 67-96 (health vanna)
- `.env.bi.example` (VANNA_API_URL · PI_BASE_URL)
- BRIEF-A-51 §3-B
- `.specify/specs/019-dashboard-ejecutivo/research.md` (vocabulario `Subscription.estado`, `Colegio.estado` ya verificado)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:0x COT |
| **Autor** | Dev BI-2 |
