# Implementation Plan: SPEC-171 — Pilar B · Tablero Operativo

**Branch**: `work/002-pi-nocturno-20260817` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

---

## Summary

Tres fases: (1) backend — modelos `HealthProbe`/`IncidenteInfra` + enum audit + 12 parámetros `monitoreo.*` + worker `scripts/monitor-probes.mjs` (6 probes, re-probe, incidentes, email throttled, advisory lock) + endpoints `/api/admin/monitoreo/*`; (2) UI — renovación de `/dashboard/admin/estadisticas/operacion` con 6 semáforos + widgets (SLA/atascados/cola/errores) + autorefresco + fusión de Clasificación como sub-tab; (3) ConfigPanel — sección "Monitoreo" con labels en criollo.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10, Prisma 5.22.0, pg-boss (solo métricas), Resend |
| **Storage** | PostgreSQL 16 — migración ADITIVA (2 tablas + enum values + seed params) |
| **Testing** | Vitest integration para endpoints/servicios; unit para componentes |
| **Proceso** | `scripts/monitor-probes.mjs` separado, arrancado por `scripts/dev-restart.sh` y supervisor de prod |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| IA local | ✅ Pass | El smoke golpea Ollama local/tailnet (misma guarda `isLocalOllamaUrl`); nada sale a terceros |
| §3.5 Logs y auditoría | ✅ Pass | Incidentes en `AuditLog`; emails sin datos sensibles (solo señal + timestamps) |
| I-49 Migraciones aditivas | ✅ Pass | 2 tablas nuevas + enum values + seed upsert; cero DROP |
| Candado "sin destructivas" | ✅ Pass | El monitor solo lee, escribe probes/incidentes y envía email; jamás reinicia procesos |
| Un solo worker de cada tipo | ✅ Pass | Advisory lock PostgreSQL (patrón existente del worker de reportes) |

---

## Estado actual (verificado en fuente)

- Health: `src/app/api/health/worker/route.ts` (workerAlive por heartbeat de archivo ≤90 s vía `src/lib/worker-heartbeat.ts`; dbOk vía `dal/adapters/health`). Sin Ollama, sin Tailscale.
- Cola: `src/lib/queue-metrics.ts` (`getWorkerMetrics()` sobre `pgboss.job`) ya expuesta en `EstadisticasService.admin()` y renderizada en `AdminDashboard.tsx:147-179`.
- Clasificación: página completa `src/app/dashboard/admin/estadisticas/clasificacion/page.tsx` (365 líneas, consume `GET /api/admin/estadisticas/clasificacion`); tabs actuales en `DashboardSubNav.tsx:8-11`.
- ConfigPanel: secciones por prefijo en `src/components/modules/config-panel/types.ts:14-24` (`SECTIONS`); PATCH exige parámetro existente; seed upsert en `prisma/seed.ts:143-240`.
- Ollama: `getOllamaBaseUrl()` (`src/lib/ai/ollama-config.ts:57-67`, param `system.ollama_base_url` → env → localhost); worker hace ping a `/api/tags` (`worker-reportes.mjs:52-60`); NO existe smoke de generación.
- Email: `src/lib/email.ts` (Resend a nivel módulo; gates `alerts.*.enabled`; sin throttle genérico de infra).
- Cron: `boss.schedule()` en el worker (patrón `worker-reportes.mjs:427-491`); sin node-cron.
- AuditLog: enum `AccionAudit` ~120 valores, sin acciones de infra.
- Permisos: página operación usa módulo `estadisticas`; monitoreo worker usa `monitoreo_worker`.

---

## Diseño por fase

### Fase 1 — Backend

**Migración aditiva** (`spec_171_tablero_operativo`):
- `HealthProbe { id, senal: String (app|worker|bd|ollama_ping|ollama_smoke|tailscale), ok: Boolean, latenciaMs: Int, detalle: String?, creadoEn: DateTime @default(now()) }` + índice `(senal, creadoEn)`.
- `IncidenteInfra { id, senal: String, estado: String @default("ABIERTO"), inicio: DateTime @default(now()), fin: DateTime?, detalle: String?, ultimoEmailEn: DateTime?, creadoEn/actualizadoEn }` + índice `(senal, estado)`.
- Enum `AccionAudit`: + `INFRA_INCIDENTE_ABIERTO`, `INFRA_INCIDENTE_RESUELTO`, `INFRA_EMAIL_ENVIADO`.

**Parámetros (seed, upsert idempotente, `CategoriaParametro.SISTEMA`)** — los 12:

| Clave | Tipo | Default | Label criollo |
|-------|------|---------|---------------|
| `monitoreo.enabled` | BOOLEAN | true | Activar el vigilante del sistema |
| `monitoreo.app.intervalo_seg` | INTEGER | 60 | Cada cuánto revisamos que la app responde (seg) |
| `monitoreo.worker.heartbeat_max_seg` | INTEGER | 90 | Tiempo máximo sin señal del worker (seg) |
| `monitoreo.ollama.ping.intervalo_seg` | INTEGER | 60 | Cada cuánto tocamos la puerta del cerebro IA (seg) |
| `monitoreo.ollama.smoke.intervalo_min` | INTEGER | 5 | Cada cuánto pedimos una clasificación mínima real (min) |
| `monitoreo.ollama.smoke.modelo` | STRING | *(a compuerta)* | Modelo para la prueba mínima |
| `monitoreo.ollama.smoke.timeout_ms` | INTEGER | 60000 | Espera máxima de la prueba mínima (ms) |
| `monitoreo.tailscale.url` | STRING | "" | URL del cerebro por Tailscale (vacío = no aplica) |
| `monitoreo.tailscale.intervalo_seg` | INTEGER | 60 | Cada cuánto revisamos el túnel Tailscale (seg) |
| `monitoreo.reprobe.segundos` | INTEGER | 60 | Espera antes de confirmar un rojo (seg) |
| `monitoreo.email.throttle_min` | INTEGER | 30 | Mínimo entre correos del mismo aviso (min) |
| `monitoreo.email.destinatarios` | STRING | soporte@… | A quién avisar (separados por coma) |
| `monitoreo.autorefresh_seg` | INTEGER | 30 | Autorefresco del tablero (seg) |
| `monitoreo.atascados.horas` | INTEGER | 24 | Horas para considerar un reporte atascado |

**`scripts/monitor-probes.mjs`** (nuevo, ~300 líneas, patrón del worker existente):
- Advisory lock `pg_try_advisory_lock(123456790)`; exit 2 si ocupado.
- Loop con `setInterval` por señal según su parámetro (lee parámetros en cada ciclo vía `getParametroSistema`).
- Probes: app → `GET {NEXT_PUBLIC_APP_URL}/api/health/worker` espera 200; worker → heartbeat fresco (misma regla de `worker-heartbeat.ts`, reusando la lib); bd → `SELECT 1`; ollama_ping → `GET {ollama}/api/tags` (timeout 5 s); ollama_smoke → `POST {ollama}/api/generate` con prompt mínimo (`"responde: ok"`, `stream:false`, timeout param); tailscale → `GET {monitoreo.tailscale.url}` espera respuesta HTTP (cualquier status < 500 vale como "túnel vivo"; vacío → señal `NO_APLICA`).
- Persiste `HealthProbe` por chequeo. Rojo → agenda re-probe en `reprobe.segundos`; doble rojo → abre `IncidenteInfra` + audit + email (si fuera de throttle por `ultimoEmailEn`); verde con incidente abierto → resuelve + audit (+ email de recuperación futuro, no en esta fase).
- Email: nueva función `enviarAlertaInfra()` en `src/lib/email.ts` (texto plano, sin datos sensibles; gate `monitoreo.enabled`).
- Limpieza: borra `HealthProbe` con antigüedad > 7 días en cada ciclo horario (DELETE acotado por `creadoEn`, no destructivo del negocio).
- Arranque: `scripts/dev-restart.sh` y supervisor de prod lo levantan como segundo proceso (junto al worker de reportes; el lock permite solo uno).

**Endpoints** (todos `verifyAuth("ADMIN")` + `assertModulo(user, "estadisticas")`):
- `GET /api/admin/monitoreo/estado` → 6 semáforos: último probe por señal + incidente abierto si lo hay + `autorefresh_seg`.
- `GET /api/admin/monitoreo/incidentes?estado=&page=` → lista paginada estándar `{ items, pagination }`.
- `GET /api/admin/monitoreo/atascados` → conteos por estado intermedio con antigüedad > `monitoreo.atascados.horas` (groupBy sobre Reporte, solo conteos).
- SLA y cola: reuso — cola via `getWorkerMetrics()` (agregar al endpoint de estado o consumir el existente de estadísticas); SLA via el servicio que ya calcula `tiempoPromedioGestionMin` para Clasificación (reusar, no duplicar).

### Fase 2 — UI

- `src/app/dashboard/admin/estadisticas/operacion/page.tsx`: nuevo client `OperacionTableroClient.tsx` con tabs internos: **"Operación"** (6 semáforos + widgets) y **"Clasificación"** (contenido actual de `clasificacion/page.tsx` movido tal cual a un componente `ClasificacionTab.tsx`).
- `src/app/dashboard/admin/estadisticas/clasificacion/page.tsx`: pasa a `redirect("/dashboard/admin/estadisticas/operacion?tab=clasificacion")`. `DashboardSubNav` queda con un solo destino o se retira si ya no hay subpáginas (verificar aserción B del arch:check al regenerar).
- Semáforos: componente `SemaforoCard.tsx` (verde/amarillo/rojo/no-aplica + último chequeo + hint criollo). Autorefresco con `setInterval` leyendo `autorefresh_seg` del endpoint.
- Widgets: `WidgetCola` (reusa datos existentes), `WidgetAtascados`, `WidgetSla` (franjas: al día/por vencer/vencidos), `WidgetErrores` (fallidos cola + incidentes abiertos).
- Monitoreo worker (`/dashboard/admin/monitoreo/worker`) queda como está (su módulo `monitoreo_worker` no se toca); el tablero nuevo lo complementa, no lo reemplaza.

### Fase 3 — ConfigPanel

- `src/components/modules/config-panel/types.ts`: nueva sección `{ key: "monitoreo", label: "Monitoreo", description: "El vigilante del sistema: cada cuánto revisa, a quién avisa y qué tan seguido", prefixes: ["monitoreo."] }`.
- Labels/descripciones vienen del `descripcion` de cada parámetro en seed (patrón actual); validación por tipo ya existente (`validateValue`).

---

## Project Structure

```text
prisma/migrations/..._spec_171_tablero_operativo/migration.sql   # NUEVO (aditiva)
prisma/schema.prisma                                             # MOD: +HealthProbe +IncidenteInfra +3 AccionAudit
prisma/seed.ts                                                   # MOD: +14 parámetros monitoreo.*
scripts/monitor-probes.mjs                                       # NUEVO
scripts/dev-restart.sh                                           # MOD: levantar monitor (1 solo, lock)
src/lib/email.ts                                                 # MOD: +enviarAlertaInfra
src/lib/monitoreo/probes.ts                                      # NUEVO: lógica de probes (importable por script y tests)
src/lib/monitoreo/incidentes.ts                                  # NUEVO: abrir/resolver/throttle + audit
src/app/api/admin/monitoreo/estado/route.ts                      # NUEVO
src/app/api/admin/monitoreo/incidentes/route.ts                  # NUEVO
src/app/api/admin/monitoreo/atascados/route.ts                   # NUEVO
src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx  # NUEVO
src/components/modules/monitoreo/SemaforoCard.tsx                # NUEVO
src/components/modules/monitoreo/Widget{Cola,Atascados,Sla,Errores}.tsx     # NUEVO
src/app/dashboard/admin/estadisticas/clasificacion/              # MOD: redirect; contenido → ClasificacionTab.tsx
src/components/modules/config-panel/types.ts                     # MOD: sección Monitoreo
tests: endpoints monitoreo (integration), incidentes service (integration), SemaforoCard/widgets (unit)
docs/architecture/                                               # REGENERAR (rutas API nuevas + redirect)
```

---

## Orden de implementación (tasks.md tras compuerta)

1. Migración + seed params + enum audit.
2. `src/lib/monitoreo/*` (probes + incidentes + throttle) con tests de integración.
3. `scripts/monitor-probes.mjs` + dev-restart + email.
4. Endpoints + tests.
5. UI tablero + fusión Clasificación + redirect + tests de componente.
6. ConfigPanel sección + docs/architecture + gate local completo.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| El smoke contra un modelo 14b-32b tarda demasiado | Timeout propio del smoke (param, default 60 s); modelo configurable — default a validar en compuerta |
| El monitor escribe probes aunque la BD esté lenta | Probes con timeout y try/catch por señal; un fallo de escritura no tumba el loop |
| Fusión de Clasificación rompe bookmarks/tests E2E | Redirect permanente desde la ruta vieja; actualizar referencias (nav, tests, docs) |
| Segundo proceso en prod sin supervisor | Documentar en quickstart + `dev-restart.sh`; el advisory lock evita duplicados aunque se levante dos veces |
| Spam de emails ante flapping (verde/rojo intermitente) | Doble robo para abrir (re-probe) + throttle por tipo + incidente único abierto por señal |

---

## Decisiones para compuerta §4

1. **Modelo del smoke**: default propuesto `qwen2.5:14b` (el más liviano de los 3 activos en prod) con timeout 60 s; param editable. ¿O prefieres un modelo tiny dedicado (ej. `gemma2:2b`) que habría que bajar en la Mac?
2. **14 parámetros** (el brief dice ~11; la lista real con labels quedó en 14 — incluye `atascados.horas` y `autorefresh_seg`). Sección única "Monitoreo".
3. **Fusión Clasificación**: sub-tab dentro de Operación con redirect desde la ruta vieja (conserva bookmarks y no pierde ninguna métrica actual).
4. **Sin email de recuperación en esta fase** (solo apertura de incidente; recuperación = cambio de semáforo visible + cierre auditado). ¿Lo quieres incluido?
5. **Tailscale probe**: reachability HTTP de `monitoreo.tailscale.url` (cualquier respuesta < 500 = túnel vivo); vacío = "no aplica" (dev).
