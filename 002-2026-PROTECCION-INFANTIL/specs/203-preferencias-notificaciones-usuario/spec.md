> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Feature Specification: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

**Feature Branch**: `work/002-PI-motor-notif-lote1`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Input**: 002-PI-100. Panel de preferencias de notificaciones para rector de colegio, comité, operador y padre, permitiendo opt-out de notificaciones no transaccionales. Generalizar `CentroNotificaciones.tsx` a componente reutilizable multi-rol. Fuente de diseño: [BRIEF-MOTOR-NOTIFICACIONES.md](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MOTOR-NOTIFICACIONES.md) §4, §5.4, §7, §9.

Objetivo: cada usuario autenticado puede ver y configurar qué notificaciones del motor recibe (email e in-app), respetando que las transaccionales (`obligatoria: true`) no se pueden apagar. El centro de notificaciones (campana) debe mostrar notificaciones del motor para todos los roles que las tengan habilitadas.

Impacto en arquitectura: nueva ruta `/dashboard/perfil/notificaciones`, endpoints `src/app/api/notificaciones/preferencias/**`, generalización de `CentroNotificaciones.tsx`, posible cambio de `src/app/api/colegio/notificaciones/**` para unificar bandeja. No se toca `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Panel de preferencias (Priority: P1)

Como usuario autenticado quiero ver un panel con todas las notificaciones configurables del motor y poder activar/desactivar las no transaccionales.

**Why this priority**: cumple Ley 1581 (opt-out) y mejora experiencia.

**Independent Test**: `GET /api/notificaciones/preferencias` devuelve lista con estado habilitado/deshabilitado y flag `obligatoria`.

**Acceptance Scenarios**:

1. **Given** un usuario `PADRE` logueado, **When** va a `/dashboard/perfil/notificaciones`, **Then** ve reglas aplicables a su rol con toggles.
2. **Given** una regla transaccional (`obligatoria: true`), **When** el usuario intenta desactivarla, **Then** el toggle está deshabilitado y muestra tooltip "Transaccional (no se puede apagar)".
3. **Given** una regla no obligatoria, **When** el usuario la desactiva, **Then** se guarda preferencia `habilitado = false`.
4. **Given** una regla no obligatoria desactivada, **When** el usuario la activa, **Then** se guarda `habilitado = true`.

### User Story 2 — Centro de notificaciones multi-rol (Priority: P1)

Como usuario de cualquier rol quiero ver en la campana las notificaciones del motor que me correspondan.

**Why this priority**: unifica la experiencia de notificaciones.

**Independent Test**: `CentroNotificaciones` muestra notificaciones del motor para el usuario autenticado sin importar rol.

**Acceptance Scenarios**:

1. **Given** un `PADRE` con notificaciones del motor habilitadas, **When** carga el header, **Then** la campana muestra el conteo de no leídas.
2. **Given** un `SCHOOL_ADMIN` con notificaciones del motor, **When** abre la campana, **Then** lista notificaciones del motor + (opcionalmente) las legacy de `NotificacionInApp`.
3. **Given** una notificación del motor marcada como leída, **When** se abre la campana, **Then** ya no aparece en no leídas.

### User Story 3 — Agrupación clara por rol/evento (Priority: P2)

Como usuario quiero que las preferencias estén agrupadas por módulo/evento con descripción legible.

**Why this priority**: usabilidad.

**Independent Test**: el panel renderiza agrupaciones legibles.

**Acceptance Scenarios**:

1. **Given** el panel, **When** se cargan preferencias, **Then** se agrupan por categoría (pagos, reportes, casos).
2. **Given** una regla, **When** se muestra, **Then** incluye descripción legible del evento y canales (email/in-app).

### User Story 4 — Sincronización con opt-out del motor (Priority: P1)

Como sistema quiero que, al desactivar una preferencia, el motor no programe más notificaciones de ese evento+canal para ese usuario.

**Why this priority**: integridad funcional.

**Independent Test**: desactivar preferencia + llamar `motor.programar` → no se crea notificación para ese usuario.

**Acceptance Scenarios**:

1. **Given** preferencia `reporte.resuelto.email` deshabilitada, **When** el motor programa notificaciones de ese evento, **Then** se omite al usuario.
2. **Given** preferencia deshabilitada, **When** existe una notificación programada futura de ese evento+canal, **Then** el sistema opcionalmente la cancela (decisión de implementación documentada).

---

## Functional Requirements

FR-001: Debe existir la ruta `/dashboard/perfil/notificaciones` accesible para usuarios autenticados.

FR-002: `GET /api/notificaciones/preferencias` DEBE devolver las reglas activas aplicables al rol del usuario, con su preferencia actual y flag `obligatoria`.

FR-003: `PATCH /api/notificaciones/preferencias` DEBE actualizar `habilitado` para una o más preferencias, rechazando cambios en reglas `obligatoria: true`.

FR-004: `CentroNotificaciones` DEBE generalizarse para listar notificaciones del motor del usuario autenticado, independientemente del rol.

FR-005: El centro de notificaciones DEBE consumir endpoint unificado (ej. `/api/notificaciones`) que devuelva notificaciones del motor (y opcionalmente legacy si aplica).

FR-006: Las preferencias DEBEN almacenarse en `NotificacionPreferencia` y ser efectivas inmediatamente para nuevas programaciones.

FR-007: El motor (`programar`) DEBE consultar preferencias antes de crear notificaciones no obligatorias.

FR-008: El panel DEBE mostrar reglas transaccionales como no editables con indicador visual.

FR-009: No se DEBE tocar `src/lib/ai/**`.

---

## Success Criteria

- Panel de preferencias accesible y funcional para PARENT/SCHOOL_ADMIN/OPERADOR/COMITE.
- Centro de notificaciones muestra notificaciones del motor multi-rol.
- Preferencia deshabilitada evita nuevas programaciones.
- Reglas obligatorias no se pueden apagar.
- CI verde 6/6.

---

## Assumptions

- SPEC-201 implementada.
- La bandeja in-app existente (`NotificacionInApp`) puede coexistir o unificarse; la implementación elige la menor intrusión.
- Los roles que usan el panel son: `PARENT`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`, `COMITE_CONVIVENCIA`.
- Un usuario solo tiene un rol a la vez (simplificación actual del sistema).

---

## Implementación

Ver `plan.md` y `tasks.md`. Se completará tras aprobación de ZEUS.
