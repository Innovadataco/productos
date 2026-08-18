# Feature Specification: SPEC-176 — Cursos: ver y reactivar desactivados

**Feature Branch**: `work/002-pi-073`

**Created**: 2026-08-18

**Status**: IMPLEMENTADO

**Implementación** (2026-08-18): ver [cierre.md](./cierre.md). Toggle Mostrar desactivados + reactivación auditada con acción propia (COLEGIO_CURSO_ACTIVADO, migración aditiva).

Impacto en arquitectura: mínimo — un parámetro de consulta en el listado de cursos (`GET /api/colegio/cursos?incluirInactivos=true`), un método de repositorio y UI en la página de cursos. Sin cambios de modelo ni migraciones.

**Input**: Instructivo 002-PI-073. Contexto: hoy `/dashboard/colegio/cursos` solo lista cursos activos (`CursoRepository.listarActivos` filtra `estado: "activo"`). Un curso desactivado desaparece de la interfaz y no hay forma de reactivarlo desde la UI (caso real del CEO: "Curso DEMO 010 / 10°" quedó desactivado e invisible). El endpoint `PATCH /api/colegio/cursos/[id]/estado` ya soporta `activo`/`inactivo` — falta listar los inactivos y ofrecer la reactivación.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector ve y reactiva cursos desactivados (Priority: P1)

Como rector quiero ver los cursos desactivados de mi colegio y reactivarlos con un clic, para corregir una desactivación accidental sin pedir soporte.

**Why this priority**: caso real en prod — un curso desactivado hoy desaparece y queda bloqueado sin vía de recuperación.

**Independent Test**: desactivar un curso, activar "Mostrar desactivados", verificar que aparece con su marca y que el botón "Activar" lo devuelve a activo.

**Acceptance Scenarios**:

1. **Given** la página de cursos, **Then** por defecto muestra solo activos (comportamiento actual intacto) y ofrece un toggle "Mostrar desactivados".
2. **Given** el toggle activo, **When** se recarga la lista, **Then** incluye los cursos inactivos del colegio, cada uno con una marca visible ("Desactivado") y botón "Activar".
3. **Given** un curso inactivo, **When** el rector pulsa "Activar", **Then** se llama `PATCH /api/colegio/cursos/[id]/estado` con `{ estado: "activo" }` (mismo endpoint de "Desactivar") y el curso vuelve a la lista de activos.
4. **Given** el endpoint con `?incluirInactivos=true`, **Then** devuelve activos e inactivos del colegio autenticado SOLAMENTE (aislamiento `colegioId`); sin el parámetro, devuelve solo activos (compatibilidad).
5. **Given** el audit trail, **Then** la reactivación queda auditada igual que la desactivación (el endpoint ya lo hace).

---

### Edge Cases

- Colegio sin cursos inactivos con el toggle activo: lista igual que la de activos, sin errores.
- Activar un curso ya activo: el endpoint responde sin romper (hoy devuelve el curso sin cambio si el estado es el mismo).
- Inactivos de OTRO colegio: nunca aparecen (tenant-first verificado por test).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `CursoRepository` DEBE poder listar activos + inactivos del colegio bajo demanda (método con opción `incluirInactivos` o método nuevo), conservando el orden por nombre.
- **FR-002**: `GET /api/colegio/cursos` DEBE aceptar `?incluirInactivos=true` (default false = comportamiento actual) validado con Zod, manteniendo el aislamiento por `colegioId`.
- **FR-003**: La página de cursos DEBE ofrecer el toggle "Mostrar desactivados", marcar los inactivos con badge "Desactivado" y ofrecer "Activar" solo en inactivos (en activos sigue "Desactivar").
- **FR-004**: La reactivación DEBE usar el endpoint existente `PATCH /api/colegio/cursos/[id]/estado` (sin endpoint nuevo) y quedar auditada.
- **FR-005**: Ningún cambio de modelo ni migración; soft-delete se mantiene (nunca borrado físico).

### Key Entities

- **Curso**: `estado` ("activo"|"inactivo"); soft-delete existente. Sin cambios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un curso desactivado se puede reactivar desde la UI en ≤ 3 clics (toggle → Activar → confirmación).
- **SC-002**: Los tests cubren: listado con/sin inactivos, aislamiento por colegio, reactivación 200 y auditoría.
- **SC-003**: Gate local completo verde y CI del PR verde.

## Assumptions

- El toggle no persiste preferencia (vuelve a "solo activos" al recargar la página) — simple y suficiente.
- La paginación del listado se mantiene como está hoy (si aplica); el filtro se pasa al endpoint.
- "Desactivado" es la etiqueta visible del estado `inactivo` (lenguaje ya usado en la UI actual).
