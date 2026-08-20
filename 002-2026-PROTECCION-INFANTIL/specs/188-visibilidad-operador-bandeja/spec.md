# Feature Specification: SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083)

**Feature Branch**: `work/002-pi-083`

**Created**: 2026-08-20

**Status**: PLANEADO

**Implementación**: pendiente aprobación de ZEUS (compuerta §4). Ver [plan.md](./plan.md) y [tasks.md](./tasks.md).

Impacto en arquitectura: cambios en UI de bandeja (`AdminReportesTable`), servicio de timeline (`timeline-proceso.ts`) y `AuditLogRepository`. Cero cambios en el motor `src/lib/ai/**` y ninguna migración.

**Input**: 002-PI-083. El CEO no puede saber a qué operador está asignado un reporte sin abrir el detalle uno por uno. El backend ya soporta filtro `?operadorId=` en `/api/admin/reportes-revision`, pero la UI no lo expone. El timeline "Ver proceso" no muestra eventos de asignación/reasignación/desasignación de operador.

Objetivo: exponer el operador asignado en la bandeja de reportes, permitir filtrar por operador, y enriquecer el timeline "Ver proceso" con eventos de asignación de operador.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Columna Operador en la bandeja (Priority: P1)

Como admin quiero ver en la tabla de reportes a qué operador está asignado cada caso, para priorizar la revisión sin abrir el detalle.

**Why this priority**: reduce clicks y mejora la operación diaria.

**Independent Test**: cargar la bandeja con reportes asignados y sin asignar; verificar que la columna muestra el email o "Sin asignar".

**Acceptance Scenarios**:

1. **Given** un reporte con `operadorId` asignado, **When** se renderiza la bandeja, **Then** la columna "Operador" muestra el email del operador.
2. **Given** un reporte sin operador, **When** se renderiza la bandeja, **Then** la columna muestra "Sin asignar" en gris.
3. **Given** un email largo, **Then** se trunca visualmente con tooltip que muestra el email completo.

### User Story 2 — Filtro por operador (Priority: P1)

Como admin quiero filtrar la bandeja por operador, para ver solo los casos de una persona.

**Why this priority**: el backend ya soporta `?operadorId=`; la UI debe exponerlo.

**Independent Test**: seleccionar un operador del dropdown, aplicar filtros y verificar que el query param llega al endpoint.

**Acceptance Scenarios**:

1. **Given** la lista de operadores activos cargada desde `/api/admin/operadores`, **When** el admin selecciona uno, **Then** se añade `?operadorId=<id>` a la URL y se recarga la bandeja.
2. **Given** un operador seleccionado, **Then** el backend filtra y el resultado solo incluye reportes asignados a ese operador.
3. **Given** la opción "Todos", **Then** no se envía `operadorId`.

### User Story 3 — Timeline enriquecido con asignaciones (Priority: P1)

Como admin quiero ver en "Ver proceso" cuándo y por quién se asignó, reasignó o desasignó un operador, para entender la historia completa del caso.

**Why this priority**: el timeline actual solo muestra transiciones de estado y reintentos; falta la trazabilidad de asignaciones.

**Independent Test**: abrir "Ver proceso" de un reporte con asignaciones en `AuditLog`; verificar que aparecen intercaladas cronológicamente.

**Acceptance Scenarios**:

1. **Given** eventos `OPERADOR_ASIGNADO`, `OPERADOR_REASIGNADO` o `OPERADOR_DESASIGNADO` en `AuditLog` para el reporte, **When** se consulta el timeline, **Then** aparecen con fecha, tipo de evento, email del operador afectado y email del admin que ejecutó la acción.
2. **Given** un evento de asignación, **Then** el texto es "Asignado a `<operador>` por `<admin>`" (o equivalente para reasignación/desasignación).
3. **Given** múltiples eventos, **Then** se ordenan cronológicamente junto a las transiciones y reintentos existentes.

## Edge Cases

- **Operador eliminado/inactivo**: si el `operadorId` del reporte no tiene usuario, mostrar "Desconocido" o ID en gris.
- **Sin eventos de asignación**: el timeline no se rompe; simplemente no muestra esos eventos.
- **Usuario actor no disponible**: el `usuarioId` del `AuditLog` puede ser null; mostrar "sistema" o similar.
- **Filtro por operador para rol OPERADOR**: los operadores solo ven sus casos (`where.operadorId = user.id`); el dropdown no debe permitirles cambiar el filtro (o mostrar solo su nombre). Se decide en compuerta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La bandeja DEBE mostrar una columna "Operador" con el email del operador asignado o "Sin asignar".
- **FR-002**: El DTO de fila de la bandeja DEBE incluir `operadorId` y `operadorEmail` (o null).
- **FR-003**: El panel de filtros DEBE incluir un dropdown "Operador" con operadores activos (`/api/admin/operadores`) y propagar `?operadorId=`.
- **FR-004**: El backend `/api/admin/reportes-revision` YA soporta `operadorId`; solo se valida que el DTO incluya el email del operador.
- **FR-005**: El servicio `obtenerTimelineProceso` DEBE consultar `AuditLog` vía `AuditLogRepository` para eventos `OPERADOR_ASIGNADO`, `OPERADOR_REASIGNADO`, `OPERADOR_DESASIGNADO` sobre el reporte.
- **FR-006**: Cada evento de asignación DEBE incluir: fecha, tipo de evento, email del operador afectado, email del actor.
- **FR-007**: Los eventos de asignación DEBEN intercalarse cronológicamente con transiciones y reintentos.
- **FR-008**: La UI "Ver proceso" DEBE renderizar los eventos de asignación con un icono distinto al de transiciones/reintentos.
- **FR-009**: No se DEBE exponer texto del reporte ni datos personales en el timeline.
- **FR-010**: No se DEBE tocar `src/lib/ai/**`.

### Key Entities

- `Reporte`: campo `operadorId` y relación `operador`.
- `Usuario`: operadores activos (rol OPERADOR).
- `AuditLog`: eventos `OPERADOR_ASIGNADO`, `OPERADOR_REASIGNADO`, `OPERADOR_DESASIGNADO` con `tipoRecurso='Reporte'` y `recursoId=<reporteId>`.

## Success Criteria *(mandatory)*

- **SC-001**: La bandeja muestra columna Operador con email o "Sin asignar".
- **SC-002**: El filtro por operador funciona end-to-end (dropdown → query param → backend → UI).
- **SC-003**: El timeline incluye eventos de asignación con operadorEmail y actorEmail.
- **SC-004**: Tests unitarios/integración cubren filtro, columna y timeline.
- **SC-005**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests, build).

## Assumptions

- El endpoint `/api/admin/operadores` ya existe y devuelve operadores activos.
- `AuditLog` ya registra eventos de asignación de operador (se confirmó en `AccionAudit`).
- El DTO de la bandeja (`ReporteListItem`) se puede extender sin romper otros consumidores.
- La UI "Ver proceso" se renderiza en `AdminReporteExpediente` o componente equivalente.

## Decisiones de compuerta §4 (propuestas)

1. **Textos del timeline**: "Asignado a `<operador>` por `<actor>`", "Reasignado a `<operador>` por `<actor>`", "Desasignado por `<actor>`".
2. **Dropdown de operadores para OPERADOR/COMITE**: se deshabilita/oculta porque su bandeja ya está filtrada por su propio id.
3. **Frontera DAL**: todo acceso a `AuditLog` pasa por `AuditLogRepository` (ya existe); se añade método `findAsignacionesReporte(reporteId)`.
