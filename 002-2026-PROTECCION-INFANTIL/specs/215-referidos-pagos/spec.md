# SPEC-215 · Código de referido (002-PI-115)

> Status: `PLANEADO`
> PI: 002-PI-115
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

## Contexto

Sistema de referidos personales del Módulo Pagos. Cada suscripción genera automáticamente un código único al crearse. Los clientes pueden aplicar un código ajeno al registrarse o renovar. Las recompensas (descuento al referido, mes gratis al referidor) se otorgan cuando admin autoriza el primer pago del referido. Depende de SPEC-210 (modelos) y SPEC-213 (evento `pago.autorizado`).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como cliente, quiero tener un código de referido único, para compartirlo y obtener beneficios. | Must |
| US-002 | Como nuevo cliente, quiero aplicar un código de referido al registrarme, para obtener un descuento en mi primer pago. | Must |
| US-003 | Como sistema, quiero evitar autorreferidos y duplicados, para preservar la integridad del programa. | Must |
| US-004 | Como sistema, quiero limitar a 5 referidos exitosos por año por código, para controlar el costo de recompensas. | Must |
| US-005 | Como referidor, quiero recibir 1 mes gratis cuando mi referido pague, para incentivar la recomendación. | Must |
| US-006 | Como admin, quiero ser notificado al 4º uso de un código, para revisar antes del tope anual. | Should |

## Acceptance Scenarios

### AS-001 · Generación de código
**Given** un nuevo cliente (colegio o padre)  
**When** se crea su `Suscripcion`  
**Then** se genera `codigoReferidoPropio` con formato `PI-<TIPO>-<HASH8>` sin caracteres O/0/I/1 y se garantiza unicidad.

### AS-002 · Aplicación válida en registro
**Given** un código `PI-COLEGIO-A7F3D2E1` de una suscripción activa  
**When** un nuevo cliente lo ingresa al registrarse  
**Then** se crea un `CodigoReferidoUso` con `año` actual y se emite `referido.registrado`.

### AS-003 · Autorreferido rechazado
**Given** un cliente que intenta usar su propio código  
**When** el sistema compara email/documento  
**Then** devuelve 409 con código `referido_autorreferido`.

### AS-004 · Duplicado rechazado
**Given** un cliente que ya fue referido por el mismo referidor  
**When** intenta usar el código de nuevo  
**Then** devuelve 409 con código `referido_ya_registrado`.

### AS-005 · Tope anual
**Given** un referidor con 5 referidos exitosos del año actual  
**When** un sexto cliente usa su código  
**Then** se registra el uso pero no se otorga recompensa hasta el próximo año.

### AS-006 · Recompensa al autorizar pago
**Given** un referido con `CodigoReferidoUso` no activado  
**When** admin autoriza el primer pago del referido  
**Then** se marca `fechaActivacion`, se aplica recompensa al referidor y se emite `referido.recompensa.otorgada`.

### AS-007 · Notificación al 4º uso
**Given** un referidor con 3 referidos activados del año  
**When** se activa el 4º  
**Then** se emite `referido.tope_anual` con mensaje "uno más y llegas al tope".

## Functional Requirements

- **FR-001**: El sistema DEBE generar `codigoReferidoPropio` automáticamente al crear una `Suscripcion`.
- **FR-002**: El formato DEBE ser `PI-<TIPO>-<HASH8>` donde `<TIPO>` es `COLEGIO` o `PADRE` y `<HASH8>` es alfanumérico sin `O`, `0`, `I`, `1`.
- **FR-003**: El sistema DEBE garantizar unicidad del código (reintento con nuevo hash si colisiona).
- **FR-004**: El sistema DEBE exponer endpoint para aplicar código referido en registro y renovación.
- **FR-005**: El endpoint DEBE validar:
  - El código existe y pertenece a una `Suscripcion` en estado `ACTIVA` (o `EN_GRACIA`).
  - No es autorreferido (mismo email o documento del titular).
  - No existe duplicado `(referidor, referido)`.
  - No supera el tope anual de 5 referidos exitosos (`pagos.referidos.max_por_año`).
- **FR-006**: Al aplicar un código válido, el sistema DEBE crear un registro en `CodigoReferidoUso` con `año` calendario Bogotá y emitir `referido.registrado`.
- **FR-007**: Al autorizar el primer pago del referido (evento `pago.autorizado`), el sistema DEBE:
  - Marcar `CodigoReferidoUso.fechaActivacion`.
  - Aplicar descuento del parámetro `pagos.referidos.descuento_referido_pct` al pago del referido.
  - Otorgar 1 mes gratis al referidor en su próxima renovación (o extensión de vigencia si aplica).
  - Emitir `referido.recompensa.otorgada`.
- **FR-008**: Al llegar al 4º uso anual de un código, el sistema DEBE emitir `referido.tope_anual`.
- **FR-009**: El tope anual DEBE calcularse en año calendario Bogotá.
- **FR-010**: El sistema DEBE registrar `AuditLog` en cada uso de código y en cada recompensa otorgada.
- **FR-011**: Todo acceso a datos DEBE pasar por `PagosRepository`.

## Non-Functional Requirements

- **NFR-001**: Gate local completo.
- **NFR-002**: Tests que cubran generación, validaciones, tope, autorreferido, recompensa.
- **NFR-003**: Logs con formato `[Referidos] <acción>: <resultado> — <código> <suscripcionId>`.

## Success Criteria

- **SC-001**: Todo usuario tiene código único (0 duplicados).
- **SC-002**: 6º uso del mismo año es rechazado o registrado sin recompensa según regla.
- **SC-003**: Autorreferido rechazado.
- **SC-004**: Recompensa aplicada tras autorizar pago del referido.
- **SC-005**: 4º uso emite `referido.tope_anual`.
- **SC-006**: CI 6/6 verde.

## Assumptions

- SPEC-210 dejó `Suscripcion.codigoReferidoPropio` y `CodigoReferidoUso`.
- SPEC-213 emite `pago.autorizado` y este SPEC se suscribe/hookea a ese evento.
- El Motor de Notificaciones tiene las reglas `referido.registrado`, `referido.recompensa.otorgada`, `referido.tope_anual`.
- Los parámetros `pagos.referidos.max_por_año`, `pagos.referidos.notificar_admin_al` y `pagos.referidos.descuento_referido_pct` existen.

## Decisiones propuestas / Deuda

1. **Código en Suscripción**: se usa `Suscripcion.codigoReferidoPropio` como fuente de verdad, no `Usuario.codigoReferido`, para alinearse con el BRIEF §5.1.
2. **Anti-autorreferido**: comparación por email y/o documento del titular; si el referido no tiene documento aún, se usa email.
3. **Recompensa referidor**: "1 mes gratis" se materializa como extensión de `fechaFin` al autorizar la siguiente renovación; no se acumula como crédito.
4. **Deuda técnica**: la recompensa del referidor requiere modificar el cálculo de vigencia en el flujo de autorización de pagos (SPEC-212).
