# Feature Specification: Admin activar suscripción manual + captura pago manual + tab "Sin suscripción"

**Feature Branch**: `work/002-PI-mega-cobros` (SPEC-245 dentro del mega-lote 2)  
**SPEC**: 245  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-148 · BRIEF-ACTIVACION-Y-COBROS §5/§6.1/§8/§10/§11 Lote 2 #6 · D-52/D-69/D-72/D-74

Impacto en arquitectura: enriquece el panel admin de pagos (`/dashboard/admin/pagos`) agregando el tab "Sin suscripción" y el modal `ActivarSuscripcionManual`; agrega endpoint `POST /api/admin/pagos/activar-manual` y endpoint `POST /api/admin/pagos/pendientes/[id]/autorizar` para autorizar solicitudes `PENDIENTE_AUTORIZACION` creadas en SPEC-244; extiende `Suscripcion` con campos de origen y pago manual (migración compartida con SPEC-244) y crea enums `OrigenSuscripcion` y `MetodoPagoManual`; emite evento `suscripcion.activada` con payload `{fechaInicio, fechaFin, plan, monto}`. Semilla idempotente de reglas/plantillas para `suscripcion.solicitada` y `suscripcion.activada`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin activa manualmente a un padre/colegio sin suscripción (Priority: P1)

Un admin en `/dashboard/admin/pagos` abre el tab "Sin suscripción", filtra por rol, selecciona un usuario/colegio, elige plan y captura estructurada del pago manual (método, referencia, monto real, fecha). Al confirmar, se crea una `Suscripcion` `ACTIVA` con `origen=ACTIVADA_MANUAL_ADMIN`.

**Why this priority**: Es el flujo B2B/B2C de activación directa por equipo comercial/ops sin pasarela automática.

**Independent Test**: Admin activa manualmente a un padre; la suscripción queda `ACTIVA` con fechas calculadas según duración del plan.

**Acceptance Scenarios**:

1. **Given** un admin autenticado, **When** accede al tab "Sin suscripción", **Then** ve listado paginado de usuarios/colegios sin suscripción activa/pendiente/en gracia.
2. **Given** un admin que selecciona un target y plan, **When** completa los campos de pago manual y confirma, **Then** se crea `Suscripcion` `ACTIVA`, `origen=ACTIVADA_MANUAL_ADMIN`, `autorizadoPorAdminId=<admin>`, `autorizadoEn=now(Bogotá)`, y se emite `suscripcion.activada`.
3. **Given** un target que ya tiene suscripción activa/pendiente, **When** intenta activar manual, **Then** el endpoint rechaza (`409`).
4. **Given** un admin no autenticado o rol no ADMIN, **When** llama al endpoint, **Then** recibe `403`.

### User Story 2 — Admin autoriza solicitud pendiente de SPEC-244 (Priority: P1)

En el tab "Pendientes" (enriquecido desde SPEC-212), el admin ve solicitudes `PENDIENTE_AUTORIZACION` de padres/colegios. Captura los datos de pago manual y autoriza; la suscripción pasa a `ACTIVA`.

**Why this priority**: Cierra el flujo de pago manual iniciado por el cliente en SPEC-244.

**Independent Test**: Admin autoriza una solicitud pendiente; el estado cambia a `ACTIVA` y se emite evento.

**Acceptance Scenarios**:

1. **Given** una solicitud `PENDIENTE_AUTORIZACION`, **When** el admin autoriza con datos de pago, **Then** la suscripción transita a `ACTIVA`, se escriben `autorizadoPorAdminId`, `autorizadoEn`, `fechaInicio`, `fechaFin`, campos de pago, y se emite `suscripcion.activada`.
2. **Given** una solicitud ya autorizada, **When** el admin intenta autorizar de nuevo, **Then** el endpoint rechaza (`409`).
3. **Given** una solicitud con método de pago inválido o monto nulo, **When** el admin intenta autorizar, **Then** el endpoint retorna `400`.

---

## Edge Cases

- **Fecha de inicio**: usa `fechaPagoReal` si se captura; de lo contrario `now(Bogotá)`. `fechaFin` se calcula sumando la duración del plan.
- **Plan con `esFreemium=true`**: en activación manual no aplica (freemium solo vía SPEC-244). El endpoint rechaza si se intenta activar manual un plan freemium.
- **Target sin usuario**: para colegios se usa `colegioId`; el `usuarioId` de la suscripción se deja null o se vincula al rector según convenga.
- **Doble click**: guard por estado impide dos autorizaciones.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE aplicar la migración compartida con SPEC-244 para extender `Suscripcion` con campos `origen`, `autorizadoPorAdminId`, `autorizadoEn`, `metodoPagoManual`, `referenciaPagoManual`, `montoRealPagado`, `fechaPagoReal`.
- **FR-002**: El sistema DEBE crear los enums `OrigenSuscripcion` y `MetodoPagoManual` (compartido con SPEC-244).
- **FR-003**: El sistema DEBE ofrecer `POST /api/admin/pagos/activar-manual` (rol ADMIN).
- **FR-004**: El sistema DEBE ofrecer `POST /api/admin/pagos/pendientes/[id]/autorizar` (rol ADMIN).
- **FR-005**: El sistema DEBE crear el tab "Sin suscripción" en `/dashboard/admin/pagos` con listado paginado y filtros.
- **FR-006**: El sistema DEBE crear el modal `ActivarSuscripcionManual` con selector de plan y captura estructurada de pago.
- **FR-007**: El sistema DEBE emitir `suscripcion.activada` con payload exacto `{fechaInicio, fechaFin, plan, monto}`.
- **FR-008**: El sistema DEBE sembrar idempotentemente reglas/plantillas de `suscripcion.solicitada` y `suscripcion.activada` en `prisma/seed.ts`.
- **FR-009**: El sistema DEBE registrar `AuditLog` de activación y autorización con delta antes/después.
- **FR-010**: El sistema DEBE rechazar activación manual de plan freemium.

### Key Entities

- `Suscripcion`: campos de origen y pago manual.
- `Plan`: duración y precio; `esFreemium`.
- `Usuario` / `Colegio`: targets de activación.
- `AuditLog`: trazabilidad.

---

## Success Criteria *(mandatory)*

- **SC-001**: Admin activa manualmente a padre/colegio en < 30s y la suscripción queda `ACTIVA` con fechas correctas.
- **SC-002**: Autorización de solicitud `PENDIENTE_AUTORIZACION` transita a `ACTIVA` y emite evento con payload esperado.
- **SC-003**: Tab "Sin suscripción" lista correctamente targets sin suscripción vigente.
- **SC-004**: Doble autorización/activación retorna `409`.
- **SC-005**: Seed idempotente: `npx prisma db seed` N veces no duplica reglas/plantillas.
- **SC-006**: CI verde 11/11.

---

## Assumptions

- SPEC-244 ya creó las solicitudes `PENDIENTE_AUTORIZACION` y los endpoints de solicitud.
- SPEC-243 ya pobló planes y parámetros.
- La migración de `Suscripcion` y enums se aplica en el primer SPEC (244) del mega-lote; SPEC-245 la reutiliza.
- SPEC-246 se encarga de entregar cupones de recompensa tras activación pagada.
