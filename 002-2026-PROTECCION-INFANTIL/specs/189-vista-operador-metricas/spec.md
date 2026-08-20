# Feature Specification: SPEC-189 — Vista de operador con métricas (002-PI-084)

**Feature Branch**: `work/002-pi-084`

**Created**: 2026-08-20

**Status**: `IMPLEMENTADO`

**Input**: 002-PI-084. El CEO quiere entrar a la ficha de un operador y ver sus casos + métricas de productividad. Hoy solo hay conteos agregados en `/admin/operadores/asignar`.

Objetivo: dar al admin una vista de detalle por operador con métricas de gestión (casos abiertos, resueltos, tiempos, categorías, tasa de escalamiento) y listados navegables, sin exponer PII ni texto de reportes.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ficha de operador con métricas (Priority: P1)

Como admin quiero ver la ficha de un operador con sus métricas de gestión, para analizar su productividad y carga de trabajo.

**Why this priority**: es el objetivo central de la spec; hoy el admin no tiene visibilidad individual más allá del conteo en la tabla de asignación.

**Independent Test**: con fixtures de reportes asignados, audit de cierre y escalamiento, el endpoint `/api/admin/operadores/[id]/metricas` devuelve los conteos y tiempos esperados.

**Acceptance Scenarios**:

1. **Given** un operador con 3 casos abiertos, 2 resueltos en los últimos 7 días y 1 escalado en los últimos 30 días, **When** se consultan sus métricas, **Then** se devuelven esos conteos y la tasa de escalamiento es 1 / (2 + 1) = 33 %.
2. **Given** un operador sin acciones de cierre en el último mes, **When** se calcula el tiempo medio de resolución, **Then** el valor es `null` (no 0).
3. **Given** un caso asignado y luego confirmado, **When** se calcula el tiempo medio, **Then** se mide desde `OPERADOR_ASIGNADO` hasta `CASO_CONFIRMADO`.

### User Story 2 — Listado paginado de casos del operador (Priority: P1)

Como admin quiero ver qué casos tiene un operador y filtrarlos por estado, para hacer seguimiento sin entrar a cada bandeja.

**Why this priority**: las métricas solas no permiten actuar; se necesita el listado operativo.

**Independent Test**: `/api/admin/operadores/[id]/casos?estado=REVISION_MANUAL&page=1` devuelve solo los casos en revisión manual del operador, paginados.

**Acceptance Scenarios**:

1. **Given** un operador con 30 casos resueltos y 5 abiertos, **When** se filtra por estado `REVISION_MANUAL`, **Then** se devuelven los 5 abiertos.
2. **Given** más de 25 casos, **When** se pide `page=2`, **Then** se devuelve la segunda página.

### User Story 3 — Navegación desde el panel de asignación (Priority: P2)

Como admin quiero ir al detalle de un operador directamente desde `/admin/operadores/asignar`, para no perder el contexto de la cola.

**Why this priority**: mejora la UX operativa; la acción principal de la fila pasa a ser "Ver detalle", sin quitar "Reasignar caso".

**Independent Test**: en `/admin/operadores/asignar`, cada fila tiene un botón "Ver detalle" que navega a `/admin/operadores/[id]`.

**Acceptance Scenarios**:

1. **Given** la tabla de asignación, **When** se hace clic en "Ver detalle" de un operador, **Then** la navegación va a `/dashboard/admin/operadores/[id]`.
2. **Given** la tabla de asignación, **Then** sigue existiendo el botón "Reasignar caso" de SPEC-181.

## Edge Cases

- **Operador inexistente o inactivo**: 404 claro.
- **Operador con rol COMITE_VALIDACION**: la vista está pensada para OPERADOR; se devuelve 400/403 con mensaje indicando que use la vista de comité.
- **Caso reasignado varias veces**: para el tiempo medio se usa la **primera** asignación del operador actual; para "casos abiertos" se usa el estado actual del reporte.
- **Cierre sin asignación previa**: se excluye del cálculo de tiempo medio (no hay fecha de inicio fiable).
- **Caso escalado y luego resuelto por comité**: cuenta como escalado para la tasa; no cuenta como "resuelto por el operador".
- **Sin datos en la ventana**: métricas con valor `null` o `0` según semántica; nunca valores inventados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer `GET /api/admin/operadores/[id]/metricas` protegido por `verifyAuth("ADMIN")` y `assertModulo(user, "operadores")`.
- **FR-002**: El endpoint de métricas DEBE devolver: `casosAbiertos` (con tiempo desde asignación por caso), `casosResueltos24h`, `casosResueltos7d`, `casosResueltos30d`, `tiempoMedioResolucionMs`, `casosPorCategoria` (últimos 30 días), `tasaEscalamientoComite` (últimos 30 días).
- **FR-003**: "Resuelto" se define como acción de AuditLog `CASO_CONFIRMADO`, `CASO_CORREGIDO` o `CASO_DADO_DE_BAJA` realizada por el operador.
- **FR-004**: "Escalado" se define como acción de AuditLog `CASO_ESCALADO` realizada por el operador.
- **FR-005**: El tiempo medio de resolución DEBE medirse desde la acción `OPERADOR_ASIGNADO` más antigua del operador en el caso hasta la primera acción de cierre del operador en el mismo caso; solo casos con ambas fechas se incluyen.
- **FR-006**: `GET /api/admin/operadores/[id]/casos` DEBE ser paginado (25/página), permitir filtro opcional `?estado=` y devolver items + `{ page, pageSize, total, totalPages }`.
- **FR-007**: La página `/dashboard/admin/operadores/[id]` DEBE mostrar cabecera (nombre, email, cupo, casos abiertos, botón volver), tarjetas de métricas, tabla de casos abiertos, tabla paginada de casos resueltos y distribución por categoría.
- **FR-008**: La página `/dashboard/admin/operadores/asignar` DEBE añadir un botón "Ver detalle" por fila que navegue a `/dashboard/admin/operadores/[id]`.
- **FR-009**: El sistema NO DEBE exponer texto de reporte, datos personales ni huellas en los endpoints ni en la UI de esta vista.
- **FR-010**: La lógica de métricas y listados DEBE residir en `OperadorService` o en un nuevo `OperadorMetricasService` dentro de `src/lib/dal/services/`, usando `ReporteRepository`, `AuditLogRepository` y `UsuarioRepository`.
- **FR-011**: La tasa de escalamiento DEBE calcularse como `escalados / (escalados + resueltos)` en la ventana de 30 días; si el denominador es 0, el valor es `null`.

### Key Entities

- `Usuario` + `PerfilOperador`: datos del operador y cupo.
- `Reporte`: casos abiertos/resueltos del operador.
- `ClasificacionIA`: categoría del reporte para la distribución.
- `AuditLog`: fuente de tiempos de asignación, cierre y escalamiento.

## Success Criteria *(mandatory)*

- **SC-001**: `GET /api/admin/operadores/[id]/metricas` devuelve métricas correctas para fixtures controlados.
- **SC-002**: `GET /api/admin/operadores/[id]/casos` pagina y filtra correctamente.
- **SC-003**: La página de detalle renderiza con datos mock sin errores.
- **SC-004**: `/admin/operadores/asignar` enlaza correctamente al detalle.
- **SC-005**: Gate local completo verde (tsc, lint --no-cache, arch:check, tests, build).
- **SC-006**: Cero migraciones de base de datos (consultas sobre modelo existente).

## Assumptions

- Las acciones de cierre canónicas son `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA` (coinciden con `ACCIONES_CIERRE` de `src/lib/dal/services/estadisticas.ts`).
- `CASO_RESUELTO_POR_COMITE` no se incluye como "resuelto por el operador" porque la resolución la ejecuta el comité, no el operador.
- El cálculo de tiempo medio usa la primera asignación del operador actual al caso; reasignaciones previas no se restan.
- La vista aplica a usuarios con `rol = OPERADOR`; `COMITE_VALIDACION` tiene su propia bandeja y no entra en esta ficha.
- La distribución por categoría muestra las categorías de `ClasificacionIA` de los reportes resueltos en los últimos 30 días.

## Decisiones de compuerta §4 (pendientes de aprobación)

1. **Definición de "resuelto"**: `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`. Excluir `CASO_RESUELTO_POR_COMITE` del numerador del operador.
2. **Tasa de escalamiento**: `escalados / (escalados + resueltos)` a 30 días; `null` si no hay denominador.
3. **Tiempo medio**: primera `OPERADOR_ASIGNADO` del operador en el caso → primera acción de cierre; casos sin asignación se excluyen.
4. **Vista solo para OPERADOR**: si el id es COMITE_VALIDACION, 400 con mensaje.
5. **Distribución por categoría**: lista ordenada (top N), sin librería de gráficos.

## Implementación

- Backend: `GET /api/admin/operadores/[id]/metricas` y `GET /api/admin/operadores/[id]/casos` en `src/app/api/admin/operadores/[id]/`.
- Servicio `OperadorMetricasService` (`src/lib/dal/services/operador-metricas.ts`) y repositorios `ReporteOperadorRepository` / `AuditLogRepository` / `UsuarioRepository`.
- Frontend: `src/app/dashboard/admin/operadores/[id]/page.tsx` con subcomponentes de métricas, casos abiertos, historial y distribución por categoría.
- Navegación: botón "Ver detalle" añadido en `/dashboard/admin/operadores/asignar/page.tsx`.
- Tests: integración de endpoints + renderizado de la página; categorías alineadas al enum `CategoriaConducta`.
- Sin migraciones; frontera DAL respetada; sin PII.

## Deuda técnica / Incidencias

- **I-72 — `seed-idempotencia.test.ts` flaky en suite completa**: al correr `npm run test` completa, `src/lib/seed-idempotencia.test.ts` dejaba un `Unhandled Rejection: process.exit(1)` originado en `prisma/seed.ts:1451`. El seed se ejecutaba al importar el módulo sin guard de CLI. Corregido con guard `import.meta.url === file://${process.argv[1]}` en `prisma/seed.ts`.
