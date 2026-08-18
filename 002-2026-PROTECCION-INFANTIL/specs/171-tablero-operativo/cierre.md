# Cierre: SPEC-171 — Pilar B · Tablero Operativo (cierra I-51)

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-nocturno-20260817` · **Compuerta §4**: APROBADA por ZEUS con decisión (smoke = modelo vigente del motor).

## Qué se implementó

1. **6 semáforos vivos** en `/dashboard/admin/estadisticas/operacion`: App, Worker, BD, Ollama-ping (`/api/tags`), Ollama-smoke (generación mínima real), Tailscale (reachability; "no-aplica" sin URL). Estado rojo = incidente ABIERTO; autorefresco `monitoreo.autorefresh_seg` (default 30 s); banner si monitoreo desactivado.
2. **Auto-recuperación sin destructivas**: probe rojo → re-probe a los `monitoreo.reprobe.segundos` → doble rojo abre `IncidenteInfra` + audit + email throttled (1 por tipo cada `monitoreo.email.throttle_min`); verde con incidente → se resuelve solo + audit. CERO reinicios/kills/purgas.
3. **Smoke con modelo vigente del motor** (decisión ZEUS): lee `ia.rubrica.modelos` (primer elemento) en cada ciclo; sin modelo → probe falla con detalle claro. Nada de modelo fijo.
4. **Widgets**: Cola (reusa `queue-metrics` vía `/api/admin/estadisticas`), Atascados (`/api/admin/monitoreo/atascados`, umbral `monitoreo.atascados.horas`), SLA (`/api/admin/estadisticas/clasificacion`), Errores (incidentes abiertos + fallidos de cola).
5. **Fusión Clasificación → sub-tab** de Operación (`?tab=clasificacion`); la ruta vieja redirige (no 404). `DashboardSubNav` retirado (quedaba con href muerto); el contenido se conserva 1:1 en `ClasificacionTab`.
6. **ConfigPanel**: sección "Monitoreo" con los 13 parámetros `monitoreo.*`, labels en criollo, validación por tipo.
7. **Monitor**: `scripts/monitor-probes.mjs` — proceso separado con advisory lock (exactamente uno), tick 5 s, relee parámetros por ciclo (cambios sin reinicio), purga de probes > 7 días. `dev-restart.sh` lo levanta junto al worker (no ejecutado: NO despliego).

## Migración

`20260818010000_spec_171_tablero_operativo` — **ADITIVA**: `CREATE TABLE HealthProbe` + `CREATE TABLE IncidenteInfra` + 2 índices + `ALTER TYPE AccionAudit ADD VALUE ×3`. Sin DROP, sin tocar índices HNSW/trgm (I-53). Aplicada en dev y test.

## Hallazgo corregido en integración

Los endpoints `/api/admin/monitoreo/*` nacieron importando `@/lib/prisma` directo (violación de la frontera DAL Q-3 que eslint detecta). Se creó `src/lib/dal/repositories/monitoreo.ts` y las rutas ahora delegan. Tests de los 3 endpoints verdes tras el refactor (17/17).

## Evidencia

- Tests backend: incidentes 11/11 · probes 15/15 · estado 7/7 · incidentes 6/6 · atascados 4/4.
- Tests UI: SemaforoCard 9/9 · OperacionTableroClient (tabs, banner, autorefresco) verde en unit.
- `npm run test:integration` full: **216 archivos / 1236 tests VERDES** (incluye monitoreo).
- `arch:check` 5/5 (huérfanos HealthProbe/IncidenteInfra declarados por diseño — tablas de infra sin FK).
- Gate: tsc · lint · arch:check · unit · integration · journeys · build · arranque — anexo en PR.

## Deuda técnica

- Email de recuperación (incidente resuelto) NO se envía en esta fase (decisión de alcance; el semáforo y el audit lo cubren).
- `worker`/`bd` comparten `monitoreo.app.intervalo_seg` como intervalo (sin parámetro propio; se puede separar después si se necesita).
- La página `/dashboard/admin/monitoreo/worker` (SPEC-156) sigue existiendo; el tablero nuevo la complementa, no la reemplaza.

## Smoke manual pendiente (CEO tras deploy)

- Semáforo rojo real con Ollama apagado ≤ 2-3 min + email throttled.
- Cambio de `monitoreo.autorefresh_seg` en ConfigPanel → el tablero lo respeta sin redespliegue.
