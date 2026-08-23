# SPEC-212 · Panel admin Pagos (002-PI-112)

> Status: `IMPLEMENTADO`
> PI: 002-PI-112
> Responsable: ODIN
> Rama: `work/002-PI-pagos-lote2`
> Base: `feature/001-scaffolding`

## Contexto

Panel completo de administración del Módulo Pagos para rol `ADMIN`. Agrega la sección **`/dashboard/admin/pagos`** (color `ambar` [D-74]) al `AdminNav` existente [D-72], con 7 tabs: pendientes de autorización, vencimientos próximos, mora, bonos promocionales CRUD, planes y precios CRUD, reembolsos, y analítica (stub que indica "Disponible en SPEC-218").

Depende de SPEC-210 (modelos + `pagos-repository`). No implementa pasarela, facturación DIAN ni analítica real; esas quedan para SPECs 211, 213, 215-218. La pestaña "analítica" es un stub intencional.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como ADMIN, quiero ver una bandeja de pagos pendientes de autorización, para revisar comprobantes subidos por clientes y decidir autorizar o rechazar. | Must |
| US-002 | Como ADMIN, quiero listar suscripciones por vencer (próximos 7 días) y en mora, para anticipar cortes y recuperar clientes. | Must |
| US-003 | Como ADMIN, quiero crear, editar y desactivar bonos promocionales, para ejecutar campañas de descuento/retención. | Must |
| US-004 | Como ADMIN, quiero editar precios de planes por año, rol y duración, para ajustar la oferta comercial sin tocar BD a mano. | Must |
| US-005 | Como ADMIN, quiero registrar un reembolso sobre un pago autorizado, para mantener el historial financiero caso a caso. | Must |
| US-006 | Como ADMIN, quiero abrir la ficha de un cliente y ver su historial de pagos + timeline de eventos + acciones administrativas, para resolver casos sin saltar entre pantallas. | Must |
| US-007 | Como ADMIN, quiero que la sección Pagos use el mismo `AdminNav` y componentes de tabla/CRUD ya vivos, para mantener coherencia visual y técnica. | Must |

## Acceptance Scenarios

### AS-001 · Acceso restringido a ADMIN
**Given** un usuario con rol `ADMIN` y otro con rol `SCHOOL_ADMIN`  
**When** ambos intentan acceder a `/dashboard/admin/pagos`  
**Then** el ADMIN ve la sección y el SCHOOL_ADMIN recibe 403.

### AS-002 · Bandeja pendientes
**Given** pagos en estado `PENDIENTE_AUTORIZACION`  
**When** el ADMIN abre el tab "Pendientes"  
**Then** ve listado paginado con identificador del cliente, monto, moneda, método, fecha de reporte y acciones autorizar/rechazar; el rechazo exige motivo.

### AS-003 · Autorizar y rechazar
**Given** un pago `PENDIENTE_AUTORIZACION`  
**When** el ADMIN autoriza  
**Then** el pago pasa a `AUTORIZADO`, se registra `autorizadoPorAdminId`, `fechaAutorizacion` y `AuditLog`. Al rechazar, pasa a `RECHAZADO` con `motivoRechazo` y `AuditLog`.

### AS-004 · Vencimientos y mora
**Given** suscripciones `ACTIVA` con `fechaFin` en ≤7 días y suscripciones `EN_GRACIA`/`SUSPENDIDA`  
**When** el ADMIN abre los tabs "Vencimientos" y "Mora"  
**Then** cada listado refleja solo los registros correspondientes, ordenados por fechaFin descendente, con días restantes/mora calculados en Bogotá.

### AS-005 · CRUD bonos
**Given** el tab "Bonos"  
**When** el ADMIN crea un bono con tipo, valor, vigencia y reglas de aplicación  
**Then** persiste en `BonoPromocional`, valida unicidad de nombre y registra `AuditLog` en creación/actualización.

### AS-006 · CRUD planes
**Given** el tab "Planes y precios"  
**When** el ADMIN edita `precioBaseUSD` o `descuentoAnualPct` de un plan existente  
**Then** el cambio solo afecta nuevos pagos; los pagos históricos conservan sus montos.

### AS-007 · Reembolsos
**Given** un pago `AUTORIZADO`  
**When** el ADMIN registra reembolso con monto, motivo y referencia externa  
**Then** el pago pasa a `REEMBOLSADO`, se registra `AuditLog` y la suscripción no se cancela automáticamente.

### AS-008 · Ficha cliente
**Given** una suscripción existente  
**When** el ADMIN navega a `/dashboard/admin/pagos/cliente/[id]`  
**Then** ve resumen de suscripción, historial de pagos, timeline de eventos del `AuditLog`, y botones de acción administrativa (autorizar/rechazar pendiente, registrar reembolso, extender vigencia manual, crear bono ad-hoc).

### AS-009 · Stub analítica
**Given** el tab "Analítica"  
**When** el ADMIN lo abre  
**Then** solo muestra un mensaje informativo: "Analítica de dinero-vs-valor disponible en SPEC-218".

## Functional Requirements

- **FR-001**: La sección `/dashboard/admin/pagos` DEBE estar disponible solo para rol `ADMIN`, reutilizando `AdminNav.tsx` y agregando el item "Pagos" con color `ambar`.
- **FR-002**: El sub-nav de la sección DEBE tener 7 tabs: `Pendientes`, `Vencimientos`, `Mora`, `Bonos`, `Planes`, `Reembolsos`, `Analítica`.
- **FR-003**: El tab `Pendientes` DEBE listar `Pago` con estado `PENDIENTE_AUTORIZACION` paginado (page/pageSize, max 100) y permitir autorizar/rechazar con `AuditLog`.
- **FR-004**: El tab `Vencimientos` DEBE listar suscripciones `ACTIVA` con `fechaFin <= hoy + 7 días` en timezone `America/Bogota`.
- **FR-005**: El tab `Mora` DEBE listar suscripciones en estado `EN_GRACIA` o `SUSPENDIDA`, ordenadas por días de mora.
- **FR-006**: El tab `Bonos` DEBE permitir crear/editar/desactivar `BonoPromocional` con validaciones del BRIEF §7.5.
- **FR-007**: El tab `Planes` DEBE permitir editar `precioBaseUSD` y `descuentoAnualPct` de planes existentes; no modifica precios retroactivos.
- **FR-008**: El tab `Reembolsos` DEBE listar pagos `AUTORIZADO` y permitir marcarlos como `REEMBOLSADO` con monto, motivo y referencia externa.
- **FR-009**: La ficha `/dashboard/admin/pagos/cliente/[id]` DEBE mostrar resumen, historial de pagos, timeline `AuditLog` y acciones administrativas.
- **FR-010**: Toda mutación crítica (autorizar, rechazar, crear/editar bono, editar plan, reembolsar, extensión manual) DEBE registrar `AuditLog`.
- **FR-011**: El tab `Analítica` DEBE ser un stub visual; NO implementar widgets.
- **FR-012**: Todo acceso a datos DEBE pasar por `pagos-repository` (DAL); cero imports de `@/lib/prisma` en endpoints/servicios.
- **FR-013**: Los endpoints de la API DEBE seguir el patrón `src/app/api/admin/pagos/**/route.ts`.
- **FR-014**: No se DEBE tocar `src/lib/ai/**`.

## Non-Functional Requirements

- **NFR-001**: Gate local completo por SPEC: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test:unit`, `test:integration`, `build`, humo `next start`.
- **NFR-002**: Las listas DEBEN usar paginación server-side estándar `{ items, pagination }`.
- **NFR-003**: UI responsiva y accesible (WCAG AA), reutilizando componentes vivos.
- **NFR-004**: `arch:check` verde; DAL de pagos no expone Prisma a endpoints.

## Success Criteria

- **SC-001**: `/dashboard/admin/pagos` accesible solo para `ADMIN` con 7 tabs.
- **SC-002**: Bandeja pendientes autoriza/rechaza pago y persiste estado + `AuditLog`.
- **SC-003**: CRUD bonos y planes funcional con validaciones.
- **SC-004**: Ficha cliente muestra historial, timeline y acciones.
- **SC-005**: Reembolso marca pago como `REEMBOLSADO` sin cancelar suscripción.
- **SC-006**: Gate local completo verde.
- **SC-007**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- SPEC-210 ya entregó modelos, enums, seed y `pagos-repository`.
- El color `ambar` y tokens semánticos existen en el design system.
- `AdminNav.tsx`, tablas admin y formularios vivos son reutilizables.
- SPEC-213 implementará la máquina de estados automática; aquí las transiciones manuales son suficientes.
- SPEC-218 implementará la analítica real; aquí solo se reserva el tab.
- El estado `REEMBOLSADO` se agrega al enum `EstadoPago` aditivamente (BRIEF §7.6).

## Decisiones propuestas para compuerta §4

1. **Reutilizar `AdminNav`** [D-72]: agregar item "Pagos" con icono y color `ambar`; no crear nav paralelo.
2. **7 tabs con componente de tabs vivo**: usar el mismo patrón de tabs del admin (ej. `UsuariosSubNav` o similar) para mantener consistencia.
3. **Analítica stub**: reservar el tab pero no implementar widgets; SPEC-218 lo rellenará.
4. **Color `ambar` para toda la sección admin de pagos** [D-74]: badges, acentos y estados activos usan tokens `ambar`.
5. **`EstadoPago.REEMBOLSADO`**: agregar estado aditivo para soportar reembolsos en v1 sin pasarela.
6. **DAL único**: todo endpoint admin/pagos consume `pagos-repository`; cero `@/lib/prisma`.

## Implementación

Entregado en rama `work/002-PI-pagos-lote2` sobre base `244e9d7c`:

- Schema/migración: `REEMBOLSADO` en `EstadoPago`; campos `montoReembolsoUSD`, `motivoReembolso`, `referenciaReembolso` en `Pago`; acciones de auditoría `PAGO_*`, `BONO_*`, `PLAN_ACTUALIZADO`, `SUSCRIPCION_EXTENSION_MANUAL`.
- `src/lib/dal/repositories/pagos-repository.ts`: métodos para pendientes, vencimientos, mora, bonos/planes, reembolsos, ficha cliente.
- `src/lib/permisos-catalogo.ts` + `prisma/seed-modulos-grants.ts`: módulo `pagos_admin` con grants para ADMIN/OPERADOR.
- `src/lib/nav-items.ts` + `src/components/modules/AdminNav.tsx`: item "Pagos" con `CurrencyDollarIcon` y color ámbar.
- UI: `src/app/dashboard/admin/pagos/**` (layout, redirect, 7 tabs, ficha cliente).
- API: `src/app/api/admin/pagos/**` (pendientes, autorizar/rechazar, vencimientos, mora, bonos, planes, reembolsos, cliente/extender).
- Tests: unitarios para `tasas.ts`, `schemas/pagos.ts`, `api-helpers.ts`; tests de integración para endpoints pendientes y tasas.

## Impacto en arquitectura:

Impacto en arquitectura: nuevas rutas `src/app/dashboard/admin/pagos/**`, `src/app/api/admin/pagos/**`; extensiones en `src/lib/dal/repositories/pagos-repository.ts`; modificación de `AdminNav.tsx` para agregar item. Migración aditiva para agregar `REEMBOLSADO` al enum `EstadoPago` si el schema aún no lo incluye. No se toca motor IA ni flujo de reportes.

## Deuda Técnica

- Tab "Analítica" queda como stub; SPEC-218 lo reemplaza por widgets reales.
- Extensión manual de vigencia y reactivación administrativa son acciones directas; reglas automáticas de estados quedan para SPEC-213.
