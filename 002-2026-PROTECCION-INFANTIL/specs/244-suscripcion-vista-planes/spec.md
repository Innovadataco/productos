# Feature Specification: Vista `/suscripcion` enriquecida + PlanesSelector + ConfirmarPagoManual + endpoints solicitar-plan/freemium

**Feature Branch**: `work/002-PI-mega-cobros` (SPEC-244 dentro del mega-lote 2)  
**SPEC**: 244  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-147 · BRIEF-ACTIVACION-Y-COBROS §3/§4/§5.1/§5.2/§6.1/§6.3/§8/§11 Lote 2 #5 · D-52/D-69/D-72/D-74

Impacto en arquitectura: enriquece `/dashboard/<rol>/suscripcion` reutilizando componentes de SPEC-211 (`SuscripcionVista`, `SuscripcionResumen`, `HistorialPagos`, `RenovacionForm`, `AplicarBonoCard`, `CodigoReferidoCard`, `CancelarSuscripcion`, `ContratoCard`, `SinSuscripcion`); agrega componentes `PlanesSelector`, `ConfirmarPagoManual` y `EsperandoAutorizacion`; agrega endpoints `POST /api/<rol>/suscripcion/solicitar-plan` y `POST /api/padre/suscripcion/activar-freemium`; extiende `Suscripcion` con campos de pago manual (`origen`, `autorizadoPorAdminId`, `autorizadoEn`, `metodoPagoManual`, `referenciaPagoManual`, `montoRealPagado`, `fechaPagoReal`) y enum `OrigenSuscripcion` coordinado con SPEC-245; emite eventos `suscripcion.solicitada` y `suscripcion.activada` (freemium). El enum `EstadoSuscripcion.PENDIENTE_AUTORIZACION` ya existe (SPEC-242), por lo que no se duplica migración.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Padre elige plan y solicita activación (Priority: P1)

Un padre sin suscripción activa ve una grilla de 4 planes (Prueba gratis · 3m · 6m · Anual) con precios COP, descuentos e IVA discriminado. Selecciona un plan, aplica un cupón si lo tiene, acepta pagar y confirma. El sistema crea una `Suscripcion` en `PENDIENTE_AUTORIZACION` con `origen=SOLICITADA_CLIENTE` y notifica al admin.

**Why this priority**: Es el flujo B2C de adquisición de plan pagado; habilita el cierre de ventas sin pasarela automática.

**Independent Test**: Padre autenticado solicita un plan anual, se crea la suscripción pendiente y se emite `suscripcion.solicitada`.

**Acceptance Scenarios**:

1. **Given** un padre sin suscripción, **When** accede a `/dashboard/padre/suscripcion`, **Then** ve `PlanesSelector` con 4 tarjetas, precios COP, descuentos e IVA discriminado según `pagos.iva.porcentaje`.
2. **Given** un padre que seleccionó plan y aplicó cupón, **When** confirma en `ConfirmarPagoManual`, **Then** se crea `Suscripcion` `PENDIENTE_AUTORIZACION`, se calcula `subtotal`, `descuentoBono`, `iva`, `total`, y se muestra `EsperandoAutorizacion`.
3. **Given** un padre con solicitud pendiente, **When** intenta confirmar de nuevo, **Then** el endpoint rechaza la segunda solicitud (`409`).
4. **Given** un padre con suscripción activa, **When** accede a `/dashboard/padre/suscripcion`, **Then** ve los componentes reutilizados de SPEC-211 (resumen, historial, etc.).

### User Story 2 — Colegio elige plan y solicita activación (Priority: P1)

Flujo análogo al padre pero para rol `SCHOOL_ADMIN`, con paleta `pino` y endpoint bajo `/api/colegio/suscripcion/solicitar-plan`.

**Why this priority**: Habilita el flujo B2B institucional de solicitud de plan.

**Independent Test**: Rector autenticado solicita plan semestral, se crea suscripción pendiente y se emite evento.

**Acceptance Scenarios**:

1. **Given** un rector sin suscripción, **When** accede a `/dashboard/colegio/suscripcion`, **Then** ve `PlanesSelector` con planes cuyo `rolDirigido` incluye `COLEGIO`.
2. **Given** un rector que confirma pago manual, **Then** se crea `Suscripcion` `PENDIENTE_AUTORIZACION` y se muestra `EsperandoAutorizacion`.

### User Story 3 — Activación freemium para padres (Priority: P1)

Un padre sin suscripción ni historial de freemium puede activar la prueba gratis de 30 días (o la duración configurada en `pagos.freemium.duracion_dias`) sin intervención del admin. El sistema crea la suscripción `ACTIVA` con `origen=FREEMIUM_AUTO`.

**Why this priority**: Reduce fricción B2C (baja fricción de onboarding). Justificación y mitigaciones documentadas en brief R-E.

**Independent Test**: Padre sin freemium previo activa prueba gratis y queda con suscripción activa.

**Acceptance Scenarios**:

1. **Given** un padre sin suscripción ni freemium previo, **When** solicita freemium con rate-limit vigente, **Then** se crea `Suscripcion` `ACTIVA`, `origen=FREEMIUM_AUTO`, `fechaFin=now(Bogotá)+duración_dias`, y se emite `suscripcion.activada`.
2. **Given** un padre que ya consumió freemium, **When** intenta activar de nuevo, **Then** el endpoint rechaza (`409`).
3. **Given** múltiples intentos de freemium desde la misma IP, **Then** el rate-limit por IP bloquea excesos.

---

## Edge Cases

- **IVA configurable**: si `pagos.iva.aplica_a` excluye al titular, el cálculo de IVA en frontend/backend debe respetarlo.
- **Cupón transferible**: un colegio puede aplicar un cupón que un padre le pasó (detalle de aplicación en SPEC-246).
- **Plan no activo**: `PlanesSelector` solo muestra planes `activo=true` para el rol del usuario.
- **Freemium con plan inexistente**: el endpoint rechaza si no hay plan freemium activo configurado.
- **Doble click**: el endpoint `solicitar-plan` verifica que no exista ya una suscripción `PENDIENTE_AUTORIZACION` o activa para el titular.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender `Suscripcion` con `origen OrigenSuscripcion`, `autorizadoPorAdminId String?`, `autorizadoEn DateTime?`, `metodoPagoManual MetodoPagoManual?`, `referenciaPagoManual String?`, `montoRealPagado Float?`, `fechaPagoReal DateTime?` (Timestamptz(6)).
- **FR-002**: El sistema DEBE crear el enum `OrigenSuscripcion { SOLICITADA_CLIENTE, ACTIVADA_MANUAL_ADMIN, FREEMIUM_AUTO, INVITACION_ADMIN }`.
- **FR-003**: El sistema DEBE crear el enum `MetodoPagoManual { TRANSFERENCIA_BANCARIA, EFECTIVO, CHEQUE, OTRO }`.
- **FR-004**: El sistema DEBE reutilizar `EstadoSuscripcion.PENDIENTE_AUTORIZACION` ya existente (no duplicar migración).
- **FR-005**: El sistema DEBE ofrecer `POST /api/padre/suscripcion/solicitar-plan` y `POST /api/colegio/suscripcion/solicitar-plan` con guard de rol dueño e idempotencia.
- **FR-006**: El sistema DEBE ofrecer `POST /api/padre/suscripcion/activar-freemium` con rate-limit por IP y guard `usosMaximosPorCliente=1`.
- **FR-007**: El sistema DEBE emitir evento `suscripcion.solicitada` (IN_APP admin + EMAIL usuario) al solicitar plan.
- **FR-008**: El sistema DEBE emitir evento `suscripcion.activada` al activar freemium.
- **FR-009**: El sistema DEBE renderizar `PlanesSelector`, `ConfirmarPagoManual` o `EsperandoAutorizacion` según el estado de la suscripción del titular.
- **FR-010**: El sistema DEBE calcular el desglose `subtotal → descuento → base → IVA → total` usando `pagos.iva.porcentaje` y respetando `pagos.iva.aplica_a`.
- **FR-011**: El sistema DEBE almacenar `AuditLog` de cada solicitud y activación freemium.

### Key Entities

- `Suscripcion`: extensión aditiva con campos de origen y pago manual.
- `Plan`: leído desde BD (SPEC-243); `precioBaseCOP`, `esFreemium`, `usosMaximosPorCliente`.
- `ParametroSistema`: `pagos.iva.*`, `pagos.freemium.*`.
- Componentes UI: `PlanesSelector`, `ConfirmarPagoManual`, `EsperandoAutorizacion`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Padre y colegio sin suscripción ven `PlanesSelector` con precios COP + IVA discriminado en < 1s.
- **SC-002**: La solicitud de plan crea `Suscripcion` `PENDIENTE_AUTORIZACION` con cálculo correcto de total y emite `suscripcion.solicitada`.
- **SC-003**: `activar-freemium` crea `Suscripcion` `ACTIVA` solo una vez por padre y responde `429` bajo rate-limit.
- **SC-004**: Doble solicitud del mismo plan retorna `409` sin crear duplicados.
- **SC-005**: Vista activa reutiliza componentes de SPEC-211 sin clonar.
- **SC-006**: CI verde 11/11.

---

## Assumptions

- SPEC-243 (CRUD admin de planes) ya mergeó: los planes y parámetros existen en BD.
- SPEC-242 (middleware vigencia) ya está en prod: el estado `PENDIENTE_AUTORIZACION` bloquea el dashboard hasta activación.
- La captura de pago manual por admin y la autorización de solicitudes vive en SPEC-245.
- La entrega de cupones de recompensa vive en SPEC-246.
- El refresh silencioso post-autorización vive en SPEC-247.
