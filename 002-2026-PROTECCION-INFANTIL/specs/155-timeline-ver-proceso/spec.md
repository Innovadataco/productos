# Feature Specification: SPEC-155 — Timeline "Ver proceso" para ADMIN

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-10

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058, brief §10. El ADMIN necesita una línea de tiempo interna que muestre el ciclo de vida de un reporte (transiciones de estado y reintentos de procesamiento) para diagnóstico operativo.

## User Scenarios & Testing

### User Story 1 — Ver timeline de un reporte (Priority: P1)

Como ADMIN, quiero ver el historial de transiciones y reintentos de un reporte en orden cronológico, para diagnosticar por qué un reporte quedó en cierto estado.

**Independent Test**: un ADMIN llama `GET /api/admin/reportes/[id]/proceso` y recibe una lista ordenada de eventos (`TransicionReporte` + `ReintentoReporte`); otro rol recibe 403.

**Acceptance Scenarios**:

1. **Given** un reporte con transiciones y reintentos, **When** el ADMIN consulta el timeline, **Then** ve todos los eventos ordenados por fecha.
2. **Given** el timeline, **Then** no expone texto del reporte ni datos personales de la víctima.
3. **Given** un OPERADOR/COMITE/PARENT/SCHOOL_ADMIN, **When** consulta, **Then** recibe 403.

## Edge Cases

- **Reporte sin transiciones**: respuesta vacía, sin errores.
- **Reporte no existe**: 404.
- **Reporte dado de baja**: el ADMIN sigue viendo el timeline (uso interno).

## Requirements

- **FR-001**: Endpoint `GET /api/admin/reportes/[id]/proceso` para `ADMIN`.
- **FR-002**: Combina `TransicionReporte` y `ReintentoReporte` ordenados por `creadoEn` ascendente.
- **FR-003**: Cada evento expone tipo, fecha, responsable (tipo + id, sin nombre), estado anterior/nuevo o intento/error.
- **FR-004**: No expone texto del reporte ni PII.
- **FR-005**: UI `/dashboard/admin/reportes/[id]/proceso` o modal en el expediente del reporte.
- **FR-006**: Tests de integración: timeline ordenado, 403 para no-ADMIN, 404 inexistente.
- **FR-007**: No toca `src/lib/ai/**`.

## Success Criteria

- ADMIN obtiene timeline cronológico sin PII.
- Roles no autorizados reciben 403.
- Gate completo verde.

## Assumptions

- `TransicionReporte` y `ReintentoReporte` ya existen y tienen índices por `reporteId`.
- El ADMIN ya accede al expediente del reporte (SPEC-096); este timeline es una pestaña adicional.

## Impacto en arquitectura

Añade endpoint, servicio y pestaña/modal de timeline. No modifica el modelo de datos.
