# Feature Specification: SPEC-156 — Panel de monitoreo del worker (ADMIN, solo lectura)

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-10

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058, brief §10. El ADMIN necesita una pantalla de monitoreo del worker que muestre su estado de salud sin permitir acciones destructivas.

## User Scenarios & Testing

### User Story 1 — Consultar estado del worker (Priority: P1)

Como ADMIN, quiero ver si el worker está vivo y cuándo fue su último heartbeat, para detectar problemas operativos sin poder detener ni reiniciar procesos.

**Independent Test**: un ADMIN accede a `/dashboard/admin/monitoreo/worker` y ve el resultado de `GET /api/health/worker`; otros roles reciben 403.

**Acceptance Scenarios**:

1. **Given** el worker funcionando, **When** el ADMIN abre el panel, **Then** ve estado "ok", workerAlive=true, dbOk=true y timestamp.
2. **Given** el worker caído, **Then** ve estado "degraded" y alerta visual.
3. **Given** un rol no ADMIN, **Then** recibe 403.
4. **Given** el panel, **Then** no hay botones de reiniciar, detener, purgar cola ni cualquier acción destructiva.

## Edge Cases

- **Sin heartbeat**: se muestra como degradado.
- **DB caída**: se muestra workerAlive según heartbeat pero dbOk=false.

## Requirements

- **FR-001**: Página `/dashboard/admin/monitoreo/worker` para `ADMIN`.
- **FR-002**: Reutilizar endpoint `GET /api/health/worker` existente.
- **FR-003**: Registrar módulo `monitoreo_worker` en `permisos-modulos.ts` y `CATALOGO_MODULOS`.
- **FR-004**: UI solo lectura: indicadores de estado, timestamp, sin acciones.
- **FR-005**: Tests de integración: ADMIN 200, no-ADMIN 403.
- **FR-006**: No toca `src/lib/ai/**`.

## Success Criteria

- ADMIN ve estado del worker en tiempo real.
- Cero botones destructivos.
- Gate completo verde.

## Assumptions

- `GET /api/health/worker` ya existe y no requiere auth (o se ajusta a ADMIN).
- El layout de admin verifica rol antes de renderizar.

## Impacto en arquitectura

Añade página y entrada en catálogo de permisos. No modifica modelo de datos ni worker.
