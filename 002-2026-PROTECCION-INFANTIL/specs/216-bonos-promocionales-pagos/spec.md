# SPEC-216 · Bonos promocionales (002-PI-116)

> Status: `PLANEADO`
> PI: 002-PI-116
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

## Contexto

Backend de aplicación de bonos promocionales del Módulo Pagos. El CRUD admin del `BonoPromocional` ya está maquetado en SPEC-212 (tab "Bonos"); esta SPEC implementa las validaciones de negocio, el endpoint de aplicación por cliente, el log de uso en `BonoAplicado` y la emisión del evento `bono.aplicado` al Motor de Notificaciones. Depende de SPEC-210 (modelos y DAL) y de SPEC-212 (tab admin de bonos).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como cliente (rector/padre), quiero aplicar un bono promocional válido a mi próximo pago, para obtener un descuento acorde a las reglas del bono. | Must |
| US-002 | Como admin, quiero que el sistema valide vigencia, topes globales, topes por cliente, tipo de titular y combinabilidad con código referido, para evitar abusos en el uso de bonos. | Must |
| US-003 | Como sistema, quiero registrar cada aplicación de bono en `BonoAplicado` y en `AuditLog`, para mantener trazabilidad de descuentos. | Must |
| US-004 | Como cliente, quiero que aplicar dos veces el mismo bono al mismo pago sea rechazado, para evitar duplicidades. | Must |
| US-005 | Como cliente, quiero recibir una notificación (opt-out) cuando se aplique un bono, para tener confirmación del descuento. | Should |

## Acceptance Scenarios

### AS-001 · Aplicación exitosa de bono de porcentaje
**Given** un bono `DESCUENTO_PCT` del 15% activo, vigente y aplicable a colegios  
**When** un rector con suscripción activa envía `POST /api/pagos/aplicar-bono` con el código  
**Then** el sistema devuelve 200 con el descuento calculado, crea un `BonoAplicado` pendiente de pago y no reduce el monto a negativo.

### AS-002 · Aplicación exitosa de bono de meses gratis
**Given** un bono `MESES_GRATIS` de 2 meses activo y vigente  
**When** un cliente lo aplica  
**Then** el sistema registra el bono y refleja la extensión de vigencia futura al autorizar el pago.

### AS-003 · Rechazo por bono inactivo o fuera de vigencia
**Given** un bono inactivo o con `vigenciaFin < hoy Bogotá`  
**When** un cliente intenta aplicarlo  
**Then** el sistema devuelve 409 con código `bono_invalido`.

### AS-004 · Rechazo por tope global
**Given** un bono con `usosMaximosTotales = 100` y 100 usos registrados  
**When** un cliente intenta aplicarlo  
**Then** el sistema devuelve 409 con código `bono_tope_global`.

### AS-005 · Rechazo por tope por cliente
**Given** un bono con `usosMaximosPorCliente = 1` ya usado por el cliente  
**When** el mismo cliente intenta aplicarlo de nuevo  
**Then** el sistema devuelve 409 con código `bono_tope_cliente`.

### AS-006 · Rechazo por tipo de titular
**Given** un bono con `aplicaSoloA = PADRE`  
**When** un rector intenta aplicarlo  
**Then** el sistema devuelve 409 con código `bono_no_aplica_rol`.

### AS-007 · Combinabilidad con código referido
**Given** un cliente con código referido aplicado y un bono `combinableConCodigoPersonal = false`  
**When** aplica el bono  
**Then** el sistema aplica solo el mayor descuento y descarta el menor.

### AS-008 · Idempotencia
**Given** un bono ya aplicado al pago pendiente del cliente  
**When** el cliente envía la misma petición  
**Then** el sistema devuelve 409 con código `bono_ya_aplicado`.

## Functional Requirements

- **FR-001**: El sistema DEBE exponer `POST /api/pagos/aplicar-bono` protegido para `SCHOOL_ADMIN` y `PARENT`.
- **FR-002**: El endpoint DEBE validar que el bono existe, está activo y se encuentra dentro de su rango de vigencia (`vigenciaInicio <= hoy Bogotá <= vigenciaFin`).
- **FR-003**: El endpoint DEBE validar que el bono no excede `usosMaximosTotales` si está definido.
- **FR-004**: El endpoint DEBE validar que el cliente no excede `usosMaximosPorCliente` para ese bono.
- **FR-005**: El endpoint DEBE validar que `aplicaSoloA` sea compatible con `tipoTitular` de la suscripción; `null` significa ambos.
- **FR-006**: El endpoint DEBE validar que el bono aplica al contexto de uso (`aplicaANuevos` para primera suscripción; `aplicaARenovaciones` para pagos de renovación).
- **FR-007**: El endpoint DEBE calcular el descuento según `tipo`:
  - `DESCUENTO_PCT`: `montoNetoUSD = montoBaseUSD × (1 - valor/100)`.
  - `DESCUENTO_FIJO_USD`: `montoNetoUSD = max(0, montoBaseUSD - valor)`.
  - `MESES_GRATIS`: descuento en términos de extensión de vigencia, sin monto negativo.
- **FR-008**: Cuando `combinableConCodigoPersonal = false` y existe descuento por código referido, el sistema DEBE aplicar solo el mayor descuento.
- **FR-009**: El sistema DEBE rechazar una segunda aplicación del mismo bono a la misma suscripción/pago con código `bono_ya_aplicado`.
- **FR-010**: El sistema DEBE crear un registro en `BonoAplicado` con `bonoId`, `suscripcionId`, `pagoId` (cuando exista), `descuentoUSD` y `aplicadoEn` en timestamp Bogotá.
- **FR-011**: El sistema DEBE emitir el evento `bono.aplicado` al Motor de Notificaciones (opt-out) tras la aplicación exitosa.
- **FR-012**: El sistema DEBE registrar `AuditLog` de la aplicación con metadatos (ids, tipo de bono, descuento) sin exponer datos sensibles.
- **FR-013**: Todo acceso a datos de pagos DEBE pasar por `PagosRepository` (frontera DAL).

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **NFR-002**: Los tests de integración del endpoint deben cubrir al menos los escenarios de éxito, vigencia vencida, tope global, tope por cliente e idempotencia.
- **NFR-003**: Respuesta del endpoint < 300 ms en BD local para validaciones simples.
- **NFR-004**: Logs en formato `[Bonos] Aplicar: <resultado> — <código> <suscripcionId>`.

## Success Criteria

- **SC-001**: `POST /api/pagos/aplicar-bono` valida las 5 reglas del BRIEF §7.5.
- **SC-002**: `BonoAplicado` registra uso, suscripción, pago y descuento con timestamp Bogotá.
- **SC-003**: Descuento nunca deja monto negativo (test explícito).
- **SC-004**: Segunda aplicación idéntica es rechazada.
- **SC-005**: Evento `bono.aplicado` visible en cola del motor notif.
- **SC-006**: CI 6/6 verde.

## Assumptions

- El CRUD admin de `BonoPromocional` existe por SPEC-212.
- El Motor de Notificaciones (SPEC-201) expone `motor.programar()` y tiene la regla `bono.aplicado` sembrada.
- Los modelos de SPEC-210 (`BonoPromocional`, `BonoAplicado`, `Suscripcion`, `Pago`) están disponibles.
- El cálculo de montos base en USD ya fue resuelto por SPEC-210 / SPEC-214.

## Decisiones propuestas / Deuda

1. **Aplicación vinculada a pago**: se permite pre-aplicar un bono antes de que exista el `Pago` (registro `BonoAplicado.pagoId` opcional). Al crear el pago se asocia el bono ya aplicado.
2. **Mayor descuento gana**: si bono y referido no son combinables, se compara el valor absoluto del descuento en USD y se aplica el mayor.
3. **Deuda técnica**: la lógica de combinabilidad se centraliza en `pagos-calculos.service.ts` para ser reutilizada por SPEC-215 y el flujo de autorización de pagos.
