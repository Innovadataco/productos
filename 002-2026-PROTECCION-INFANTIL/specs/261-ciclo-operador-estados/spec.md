# Feature Specification: Estados de carga del operador — `ESTADOS_CARGA_OPERADOR`

**Feature Branch**: `work/002-PI-ciclo-operador`
**SPEC**: 261
**Radicado**: 002-PI-164
**Created**: 2026-08-26
**Status**: DESARROLLO
**Input**: INSTRUCTIVO-002-PI-164 · BRIEF-CICLO-OPERADOR-Y-SPAM v1.0 · I-114 · I-121

Impacto en arquitectura: introduce **una única constante** `ESTADOS_CARGA_OPERADOR = ["REVISION_MANUAL", "POSIBLE_SPAM"]` y refactoriza los **6 puntos** donde hoy vive la lista literal, para que la carga del operador cuente `REVISION_MANUAL` **y** `POSIBLE_SPAM` de forma coherente en todas las superficies. Habilita reasignar y escalar a comité un `POSIBLE_SPAM`. Sin migraciones, sin cambios en `src/lib/ai/**`, sin cambios en el motor ni en `asignador.ts` ni en `finalizacion.ts` (ya cubren los dos estados con `in`).

Regla del CEO que gobierna: *"El spam es una clasificación más de las otras. Ese flujo no puede cambiar: el operador clasifica y/o escala a comité."*

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Panel de asignación cuenta la carga real (Priority: P1)

Un ADMIN entra a `/dashboard/admin/operadores/asignar` con la producción de hoy (1 `POSIBLE_SPAM` sin asignar y 1 `POSIBLE_SPAM` asignado a un operador; 0 `REVISION_MANUAL`). Hoy ve "sin asignar: 0" y "operador: 0 casos"; después del fix debe ver "sin asignar: 1" y "operador: 1 caso".

**Why this priority**: el tablero de asignación es la herramienta operativa del CEO. Mientras miente, no se puede rebalancear.

**Independent Test**: `OperadorService.panelAsignacion()` con seed que crea 1 `POSIBLE_SPAM` sin operador y 1 `POSIBLE_SPAM` asignado devuelve `{ sinAsignar: 1, operadores: [{ casosAbiertos: 1, ... }] }`.

**Acceptance Scenarios**:

1. **Given** 1 reporte `POSIBLE_SPAM` sin operador y 0 en `REVISION_MANUAL`, **When** el ADMIN abre el panel de asignación, **Then** el conteo "sin asignar" es 1.
2. **Given** 1 reporte `POSIBLE_SPAM` asignado al operador A y 0 en `REVISION_MANUAL`, **When** se calcula la distribución, **Then** el operador A aparece con `casosAbiertos = 1`.
3. **Given** el listado de operadores (`GET /api/admin/operadores`), **When** un operador tiene 2 `POSIBLE_SPAM` y 3 `REVISION_MANUAL` asignados, **Then** su `casosAbiertos` es 5.

### User Story 2 — El rescatador de huérfanos recoge `POSIBLE_SPAM` (Priority: P1)

Un reporte `POSIBLE_SPAM` sin operador (creado antes de existir un operador activo) debe ser recogido por `reconciliarHuerfanos()` en su próxima corrida (≤15 min).

**Why this priority**: en producción hay un huérfano vivo (`RPT-2JFULR`) que el rescatador ha ignorado 7 corridas seguidas.

**Independent Test**: seed con 1 reporte `POSIBLE_SPAM` `operadorId: null` + 1 operador activo → `reconciliarHuerfanos()` devuelve `{ encontrados: 1, asignados: 1 }` y el reporte queda con `operadorId` puesto.

**Acceptance Scenarios**:

1. **Given** un `POSIBLE_SPAM` huérfano vivo y un operador activo con cupo, **When** corre el rescatador, **Then** el reporte queda asignado.
2. **Given** un `REVISION_MANUAL` huérfano y un `POSIBLE_SPAM` huérfano, **When** corre el rescatador, **Then** ambos quedan asignados y `encontrados = 2`.
3. **Given** un `POSIBLE_SPAM` ya asignado, **When** corre el rescatador, **Then** NO se toca (queda con el mismo `operadorId`).

### User Story 3 — El admin reasigna un `POSIBLE_SPAM` a otro operador (Priority: P2)

Un ADMIN debe poder reasignar un reporte `POSIBLE_SPAM` a otro operador desde el panel actual, sin cambiar la mecánica ni la UI.

**Independent Test**: `reasignarReporte({ reporteId, operadorDestinoId, motivo, adminId })` sobre un `POSIBLE_SPAM` con operador origen ≠ destino devuelve el reporte reasignado y registra `AuditLog` con `estadoAnterior/estadoNuevo = "POSIBLE_SPAM"`.

**Acceptance Scenarios**:

1. **Given** un `POSIBLE_SPAM` con operador A, **When** el ADMIN reasigna al operador B, **Then** el `PATCH` responde 200 y el reporte queda con operador B.
2. **Given** un reporte `CLASIFICADO`, **When** el ADMIN intenta reasignarlo, **Then** responde 400 (fuera de estados de carga).
3. **Given** el operador destino es el mismo que el actual, **When** se intenta reasignar, **Then** responde 400.

### User Story 4 — El operador escala a comité un `POSIBLE_SPAM` asignado a él (Priority: P1)

Un OPERADOR con un `POSIBLE_SPAM` asignado ve el botón "Escalar a comité" y la escalación funciona.

**Why this priority**: sin esta ruta el spam vive en un ciclo cerrado; el operador no puede desatorar dudas.

**Independent Test**: `GET /api/admin/reportes-revision/:id` con OPERADOR dueño y `POSIBLE_SPAM` devuelve `puedeEscalar: true`. `POST /api/admin/reportes/:id/escalar` con motivo válido responde 201 y crea `SolicitudComite` `PENDIENTE`.

**Acceptance Scenarios**:

1. **Given** OPERADOR A dueño de un `POSIBLE_SPAM`, **When** consulta el detalle de revisión, **Then** `puedeEscalar` es `true`.
2. **Given** el mismo caso, **When** llama a `POST .../escalar` con motivo, **Then** se crea la solicitud y el reporte pierde `operadorId` (siguiendo el patrón actual de `REVISION_MANUAL`).
3. **Given** OPERADOR B (no dueño) sobre el mismo `POSIBLE_SPAM`, **When** intenta escalar, **Then** responde 403.
4. **Given** un `CLASIFICADO` o `PENDIENTE`, **When** cualquiera intenta escalar, **Then** responde 409 (fuera del ciclo del operador).

### Edge Cases

- Un `POSIBLE_SPAM` con `clasificacion.categoria !== "SPAM"` (caso `RPT-2JFULR`, ganó `OFRECIMIENTO_REGALOS`): la carga cuenta igual, el rescatador lo ve igual, el operador puede escalarlo igual.
- Un `POSIBLE_SPAM` `eliminado: true`: no cuenta como carga y no lo recoge el rescatador (mismo predicado `whereReporteVigente`).
- La constante `ESTADOS_CARGA_OPERADOR` **no** se abre a otros estados sin decisión de ZEUS: si mañana surge un tercer estado de carga, se agrega en un único sitio.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exportar `ESTADOS_CARGA_OPERADOR = ["REVISION_MANUAL", "POSIBLE_SPAM"] as const` desde `src/lib/operadores/estados.ts` (fuente única). Su tipo debe derivarse de `EstadoReporte` para que Prisma valide en compile-time.
- **FR-002**: `src/lib/dal/services/operadores.ts` DEBE consumir `ESTADOS_CARGA_OPERADOR` en (a) `listar()` → `casosAbiertos` del OPERADOR (línea 75), y (b) `panelAsignacion()` → conteo "sin asignar" y `groupByOperador` (líneas 363–365). Ninguna de esas tres consultas puede quedar con literal `"REVISION_MANUAL"`.
- **FR-003**: `src/lib/operadores/reconciliacion-huerfanos.ts` DEBE buscar huérfanos con `estado: { in: ESTADOS_CARGA_OPERADOR }` en lugar del literal actual (línea 27). Los reportes recogidos se asignan con el asignador existente (sin cambios).
- **FR-004**: `src/lib/operadores/reasignar-service.ts` DEBE validar `ESTADOS_CARGA_OPERADOR.includes(reporte.estado)` en lugar de `reporte.estado !== "REVISION_MANUAL"` (línea 39). Los `estadoAnterior/estadoNuevo` en el `AuditLog` reflejan el estado real del reporte, no un literal fijo.
- **FR-005**: `src/app/api/admin/reportes-revision/[id]/route.ts` DEBE calcular `puedeEscalar = (rol === "OPERADOR" && operadorId === user.id && ESTADOS_CARGA_OPERADOR.includes(estado)) || esAdminRol(rol)` (línea 78).
- **FR-006**: `src/app/api/admin/reportes/[id]/escalar/route.ts` DEBE aceptar reportes cuyo estado esté en `ESTADOS_CARGA_OPERADOR` (hoy exige `REVISION_MANUAL` en línea 88). La solicitud creada mantiene el mismo shape.
- **FR-007**: El nuevo helper `whereReporteEnEstadosCarga(extra?)` (opcional) o el uso directo de `whereReporteEnEstados(ESTADOS_CARGA_OPERADOR, extra)` DEBE preservar `eliminado: false` (candado SPEC-122).
- **FR-008**: Los tests DEBEN abrir un componente de las 6 superficies (no solo API) para cada punto: `AdminReportesTable`, panel de asignación, listado de operadores, huérfanos, reasignar, escalar. Objetivo: cerrar el defecto raíz (las divergencias sobrevivieron porque nadie abrió las pantallas).

### Key Entities

- `Reporte` (Prisma): campos leídos `estado`, `operadorId`, `eliminado`. Sin cambio de schema.
- `AuditLog`: nueva entrada `RECONCILIACION_HUERFANOS` puede incluir spam sin cambio (el JSON ya es libre); `REPORTE_REASIGNADO` con `estadoAnterior/Nuevo` reales.
- `SolicitudComite`: sin cambio; el reporte puede llegar desde `POSIBLE_SPAM` o `REVISION_MANUAL`.

---

## Success Criteria *(mandatory, measurable)*

- **SC-001**: existe `ESTADOS_CARGA_OPERADOR` en un único archivo (`src/lib/operadores/estados.ts`) y **los 6 puntos de §4.1 del brief la consumen**. `grep -rn '"REVISION_MANUAL"' src/lib/dal/services/operadores.ts src/lib/operadores/reconciliacion-huerfanos.ts src/lib/operadores/reasignar-service.ts src/app/api/admin/reportes-revision/\[id\]/route.ts src/app/api/admin/reportes/\[id\]/escalar/route.ts` no devuelve literales de carga en esos puntos.
- **SC-002**: `/dashboard/admin/operadores/asignar` con 1 `POSIBLE_SPAM` sin asignar y 1 asignado muestra "sin asignar: 1" y operador con 1 caso. Verificado en test de componente/servicio y **en vivo** post-deploy (SC-013).
- **SC-003**: `reconciliarHuerfanos()` con 1 `POSIBLE_SPAM` huérfano deja el reporte asignado en la misma corrida.
- **SC-004**: `PATCH /api/admin/reportes-revision/:id/reasignar` sobre un `POSIBLE_SPAM` responde 200.
- **SC-005**: OPERADOR dueño de un `POSIBLE_SPAM` recibe `puedeEscalar: true` y `POST .../escalar` responde 201.
- **SC-013**: verificación en vivo post-deploy (ver INSTRUCTIVO §Cadena de comandos): entrar como operador y como admin y comprobar SC-002 y SC-005 pantalla por pantalla.

---

## Assumptions

- El asignador (`asignador.ts:121`) ya cuenta ambos estados con `in`. No se toca.
- `finalizacion.ts:88,123` ya asigna operador a ambos estados. No se toca.
- El motor (`src/lib/ai/**`) quedó bien con SPEC-207. No se toca (candado del INSTRUCTIVO).
- El panel `/dashboard/admin/spam` no cambia de naturaleza. La bandeja del operador (`/dashboard/admin/reportes-revision`) no se rediseña.
- La verificación por consulta directa a la BD (SC-002 real) se hace tras deploy usando `psql`/panel; los tests unitarios/integración cubren el mismo predicado en Vitest.

---

## Dependencies

- Sin dependencia previa. Puede ir en paralelo al Rescate Pagos (002-PI-157). **Merges secuenciales**: primero Pagos, luego este.
