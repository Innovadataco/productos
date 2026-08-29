# Tasks: SPEC-171 — Pilar B · Tablero Operativo

**Input**: `specs/171-tablero-operativo/{spec,plan}.md`
**Compuerta §4**: PENDIENTE de ZEUS. Borrador derivado del plan; se ajusta con el veredicto (modelo smoke, 14 parámetros, fusión, sin email recuperación, probe tailscale).

## Phase 1: Backend — modelos + parámetros + monitor

- [ ] **T001** Migración aditiva `spec_171_tablero_operativo`: `HealthProbe` (senal, ok, latenciaMs, detalle, creadoEn; índice (senal, creadoEn)) + `IncidenteInfra` (senal, estado, inicio, fin, detalle, ultimoEmailEn; índice (senal, estado)) + `AccionAudit` += `INFRA_INCIDENTE_ABIERTO`, `INFRA_INCIDENTE_RESUELTO`, `INFRA_EMAIL_ENVIADO`.
- [ ] **T002** `prisma/seed.ts`: 14 parámetros `monitoreo.*` (upsert idempotente, labels criollo según plan).
- [ ] **T003** `src/lib/monitoreo/probes.ts` (NUEVO): probes app/worker/bd/ollama_ping/ollama_smoke/tailscale con timeouts; reuso `worker-heartbeat.ts` y `ollama-config.ts`.
- [ ] **T004** `src/lib/monitoreo/incidentes.ts` (NUEVO): doble rojo → abrir incidente + audit; verde → resolver + audit; throttle email por `ultimoEmailEn`.
- [ ] **T005** `src/lib/email.ts`: `enviarAlertaInfra()` (texto plano, gate `monitoreo.enabled`, sin datos sensibles).
- [ ] **T006** `scripts/monitor-probes.mjs` (NUEVO): advisory lock, loop por señal leyendo parámetros por ciclo, limpieza de probes > 7 días.
- [ ] **T007** `scripts/dev-restart.sh`: levantar el monitor como segundo proceso.
- [ ] **T008** Tests integration de `probes.ts`/`incidentes.ts` (doble rojo, throttle, resolución, NO_APLICA tailscale vacío).

## Phase 2: Endpoints

- [ ] **T009** `GET /api/admin/monitoreo/estado` (6 semáforos + autorefresh_seg) + test.
- [ ] **T010** `GET /api/admin/monitoreo/incidentes` (paginación estándar) + test.
- [ ] **T011** `GET /api/admin/monitoreo/atascados` (conteos por estado intermedio > umbral) + test.

## Phase 3: UI tablero + fusión Clasificación

- [ ] **T012** `OperacionTableroClient.tsx` (NUEVO) con tabs internos Operación/Clasificación; `SemaforoCard.tsx`; autorefresco configurable.
- [ ] **T013** Widgets `WidgetCola` (reusa queue-metrics), `WidgetAtascados`, `WidgetSla`, `WidgetErrores`.
- [ ] **T014** Mover contenido de `clasificacion/page.tsx` a `ClasificacionTab.tsx`; ruta vieja → `redirect(".../operacion?tab=clasificacion")`; ajustar `DashboardSubNav`.
- [ ] **T015** Tests unit de `SemaforoCard` y del tablero (estados verde/amarillo/rojo/no-aplica).

## Phase 4: ConfigPanel + cierre

- [ ] **T016** `config-panel/types.ts`: sección "Monitoreo" (prefix `monitoreo.`).
- [ ] **T017** Regenerar `docs/architecture/` → arch:check verde.
- [ ] **T018** Gate local completo + `cierre.md` (smoke manual: semáforo rojo con Ollama apagado + email throttled) + sección Implementación en spec.md.
