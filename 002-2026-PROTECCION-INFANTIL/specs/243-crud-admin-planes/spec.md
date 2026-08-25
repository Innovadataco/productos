# Feature Specification: CRUD admin de Planes + parámetros IVA/freemium desde UI + seed 4 planes por rol

**Feature Branch**: `work/002-PI-146`  
**SPEC**: 243  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-146 · BRIEF-ACTIVACION-Y-COBROS §4/§6.3/§8/§10/§11 Lote 1 fila #4 · D-52/D-69/D-72/D-74

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin gestiona el catálogo de planes (Priority: P1)

El admin de la plataforma puede crear, editar, activar/desactivar y ver el detalle de los planes de suscripción desde `/dashboard/admin/pagos/planes`. Cada plan tiene nombre, precio COP, duración, rol destino (PADRE/COLEGIO), descripción, estado activo y opcionalmente un límite de usos por cliente para el freemium. El listado paginado muestra las acciones disponibles y las mutaciones quedan en `AuditLog`.

**Why this priority**: El catálogo de planes es la base de todo el flujo de suscripción (Lote 2). Sin planes sembrados y editables, `/suscripcion` no puede mostrar `PlanesSelector`.

**Independent Test**: Un admin autenticado crea un plan pagado, lo edita, lo desactiva y la base refleja cada cambio con `AuditLog` correspondiente.

**Acceptance Scenarios**:

1. **Given** un admin autenticado en `/dashboard/admin/pagos/planes`, **When** hace clic en “Crear plan” y completa nombre, precio COP, duración, rol destino y descripción, **Then** el sistema crea el plan, responde `201` y registra `AuditLog` (`PLAN_CREATE`).
2. **Given** un plan existente, **When** el admin edita el precio COP o la descripción, **Then** el sistema actualiza el plan, responde `200` y registra `AuditLog` (`PLAN_UPDATE`) con `payloadAntes` y `payloadDespues`.
3. **Given** un plan activo sin suscripciones asociadas, **When** el admin solicita desactivarlo, **Then** el sistema marca `activo=false`, responde `200` y registra `AuditLog` (`PLAN_TOGGLE`).
4. **Given** un plan con suscripciones activas, **When** el admin intenta eliminarlo, **Then** el sistema rechaza la operación con `409` y sugiere desactivar en su lugar.
5. **Given** un admin que intenta crear un plan con nombre ya existente para el mismo rol, **Then** la API retorna `409` con mensaje claro.
6. **Given** un admin que envía un payload inválido (precio negativo, duración desconocida o rol inválido), **Then** la API retorna `400` con detalles de validación Zod.

### User Story 2 — Admin edita parámetros globales de pagos (Priority: P1)

El admin puede modificar desde la misma pantalla los parámetros globales que rigen el checkout y el freemium: IVA (porcentaje y si se discrimina), duración del freemium en días y las reglas de recompensa por pago (cupones, porcentaje, vigencia, tope COP). Los cambios se aplican inmediatamente sin deploy y quedan en `AuditLog`.

**Why this priority**: Permite ajustar precios, impuestos y promociones sin tocar código ni variables de entorno, cumpliendo el principio de “configuración viva” del BRIEF §6.3.

**Independent Test**: Un admin cambia `pagos.iva.porcentaje` de 19 a 16; el endpoint de parámetros refleja el nuevo valor y `AuditLog` registra `PARAM_UPDATE`.

**Acceptance Scenarios**:

1. **Given** un admin autenticado, **When** abre la pestaña “Configuración global” y guarda los 7 parámetros de §6.3, **Then** el sistema actualiza cada `ParametroSistema` con `upsert` y registra un único `AuditLog` (`PARAM_UPDATE`) con el batch completo.
2. **Given** un admin que envía un valor fuera de rango (IVA > 100, duración freemium < 1, porcentaje descuento > 100), **Then** la API retorna `400` sin tocar la base.
3. **Given** un admin que cancela el formulario, **When** vuelve a abrirlo, **Then** ve los valores actuales de la base (no valores locales perdidos).
4. **Given** el sistema después de un reinicio, **When** lee `pagos.iva.porcentaje`, **Then** retorna el último valor editado por admin (el seed no sobreescribe cambios manuales).

### User Story 3 — Seed inicial idempotente de 4 planes por rol (Priority: P1)

Al ejecutar `npx prisma db seed` el sistema garantiza que existan 4 planes por rol (PADRE y COLEGIO): Prueba gratis 30 días, 3 meses, 6 meses y Anual. Si el admin ya editó un plan, el seed no lo sobreescribe. Los parámetros globales de §6.3 también se siembran idempotentemente.

**Why this priority**: Asegura que un entorno nuevo o purgado tenga el catálogo mínimo para que Lote 2 pueda pintar `PlanesSelector` inmediatamente.

**Independent Test**: Ejecutar `npx prisma db seed` dos veces produce el mismo número de planes y parámetros; un plan editado manualmente conserva su edición.

**Acceptance Scenarios**:

1. **Given** una base vacía, **When** se ejecuta el seed, **Then** existen exactamente 8 planes (4 PADRE + 4 COLEGIO) y los 7 parámetros globales de §6.3.
2. **Given** una base con planes ya sembrados, **When** se ejecuta el seed nuevamente, **Then** no se duplican registros y no se sobreescriben ediciones manuales (`update: {}`).
3. **Given** el plan freemium sembrado, **When** se consulta, **Then** tiene `esFreemium=true`, `duracion=MES_1`, `precioBaseCOP=0` y `usosMaximosPorCliente=1`.
4. **Given** el seed ejecutado, **When** se listan los planes por rol, **Then** aparecen ordenados visualmente: Freemium, 3 meses, 6 meses, Anual.

---

## Edge Cases

- **Plan Freemium con precio 0**: validación general exige precio > 0 para planes pagados; el freemium se permite con precio 0 y `esFreemium=true`.
- **Nombre duplicado por rol**: aunque el schema tiene unique `[tipoTitular, duracion, anio]`, el servicio valida adicionalmente que no exista otro plan con igual `nombre` para el mismo `tipoTitular`.
- **Intento de borrado con suscripciones activas**: no se permite borrado físico; el endpoint `DELETE` actúa como toggle a `activo=false`.
- **Parámetros globales con tipo incorrecto**: Zod valida tipos y rangos antes de persistir.
- **Seed sobre datos editados**: patrón `upsert({ create, update: {} })` preserva cambios manuales.
- **Tasa de cambio no disponible**: SPEC-243 almacena precios directamente en COP (`precioBaseCOP`) para el catálogo admin; no depende de la tasa de cambio en runtime.
- **Año del plan**: el formulario usa el año actual por defecto; el seed siembra para el año en curso de Bogotá.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender el modelo `Plan` aditivamente con `precioBaseCOP Float?`, `esFreemium Boolean @default(false)` y `usosMaximosPorCliente Int?`.
- **FR-002**: El sistema DEBE extender el enum `AccionAudit` aditivamente con `PLAN_CREATE`, `PLAN_UPDATE` y `PLAN_TOGGLE`.
- **FR-003**: El sistema DEBE ofrecer `GET /api/admin/pagos/planes` con paginación, filtros por `tipoTitular` y `anio`, retornando `{ items, pagination }`.
- **FR-004**: El sistema DEBE ofrecer `POST /api/admin/pagos/planes` para crear planes, validando con Zod y registrando `AuditLog` (`PLAN_CREATE`).
- **FR-005**: El sistema DEBE ofrecer `PATCH /api/admin/pagos/planes/:id` para editar planes, registrando `AuditLog` (`PLAN_UPDATE`) con valores antes/después.
- **FR-006**: El sistema DEBE ofrecer `DELETE /api/admin/pagos/planes/:id` que desactive (`activo=false`) un plan sin suscripciones asociadas; si tiene suscripciones, retornar `409`. Debe registrar `AuditLog` (`PLAN_TOGGLE`).
- **FR-007**: El sistema DEBE ofrecer `PATCH /api/admin/pagos/parametros` para actualizar en batch los parámetros globales `pagos.iva.*`, `pagos.freemium.*` y `pagos.recompensa.*`, registrando `AuditLog` (`PARAM_UPDATE`).
- **FR-008**: El sistema DEBE proteger todos los endpoints anteriores con `verifyAuth("ADMIN")` y `assertModulo(..., "pagos_admin")`.
- **FR-009**: El sistema DEBE sembrar en `prisma/seed.ts` 8 planes (4 PADRE + 4 COLEGIO) de forma idempotente usando `upsert({ create, update: {} })`.
- **FR-010**: El sistema DEBE sembrar en `prisma/seed.ts` los parámetros globales de §6.3 de forma idempotente.
- **FR-011**: El sistema DEBE implementar `PlanesAdminCRUD` en `/dashboard/admin/pagos/planes` reutilizando `GlassCard`, `Input`, `Button` y `Alerta`.
- **FR-012**: El formulario de plan DEBE incluir: nombre, precio COP, duración (enum), rol destino, descripción, activo y `usosMaximosPorCliente` (opcional).
- **FR-013**: El formulario de configuración global DEBE permitir editar IVA, freemium y recompensa con guardar/cancelar.
- **FR-014**: El sistema DEBE usar timezone Bogotá (`date-fns-tz`) para cualquier aritmética de fechas del seed y de timestamps.

### Key Entities

- **Plan**: catálogo de suscripciones. Se extiende con `precioBaseCOP`, `esFreemium` y `usosMaximosPorCliente`; conserva `precioBaseUSD` legacy.
- **ParametroSistema**: almacena `pagos.iva.porcentaje`, `pagos.iva.discriminar`, `pagos.freemium.duracion_dias`, `pagos.recompensa.*`.
- **AuditLog**: trazabilidad de cada mutación de plan o parámetro global.
- **Suscripcion**: usada para validar que un plan no tenga suscripciones activas antes de permitir su desactivación.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un admin crea, edita y desactiva un plan desde la UI en menos de 60 segundos y cada acción queda en `AuditLog`.
- **SC-002**: El seed ejecutado dos veces seguidas produce exactamente 8 planes y 7 parámetros globales, sin duplicados y sin sobreescribir ediciones manuales.
- **SC-003**: El plan Freemium sembrado tiene `esFreemium=true` y `usosMaximosPorCliente=1`.
- **SC-004**: El endpoint de parámetros globales rechaza valores inválidos (IVA > 100, días < 1) con `400`.
- **SC-005**: Un plan con `Suscripcion` activa no puede desactivarse ni eliminarse; la API retorna `409`.
- **SC-006**: El listado de planes respeta paginación estándar `{ items, pagination }` y permite filtrar por rol.
- **SC-007**: Solo usuarios con rol `ADMIN` y módulo `pagos_admin` pueden mutar planes o parámetros.
- **SC-008**: El CRUD reutiliza componentes existentes (`GlassCard`, `Input`, `Button`, `Alerta`) y no introduce clones del design system.

---

## Assumptions

- El seed conoce el ID del usuario admin creado por `prisma/seed.ts` (o lo busca por `rol=ADMIN`); si no existe, los planes no se sembrarán hasta que haya un admin.
- El campo `precioBaseUSD` legacy se conserva sin uso en la UI de SPEC-243; `precioBaseCOP` es la moneda de visualización y cálculo para Colombia por default.
- El enum `AccionAudit` admite valores aditivos sin migración destructiva (PostgreSQL `ALTER TYPE ... ADD VALUE`).
- La duración del freemium de 30 días se modela con `DuracionPlan.MES_1` y el parámetro `pagos.freemium.duracion_dias=30` se usa para calcular la fecha de fin al activar freemium en Lote 2.
- `PlanesSelector`, captura de pago manual, cupones de recompensa y vista cliente `/suscripcion` se implementan en SPECs posteriores (Lote 2).

---

## Implementación

*(Por completar tras aprobación de ZEUS en compuerta §4.)*
