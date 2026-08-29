# SPEC-217 · Freemium 30 días (002-PI-117)

> Status: `IMPLEMENTADO`
> PI: 002-PI-117
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

Impacto en arquitectura: añade el freemium del Módulo Pagos: suscripción `ACTIVA` con `esFreemium=true` por `pagos.freemium.duracion_dias` (default 30), transición a `SUSPENDIDA` al vencer sin pago vía el worker de vigencia (SPEC-213) y extensión de vigencia desde `freemiumFechaFin` si paga durante el freemium.

## Contexto

Freemium del Módulo Pagos: al registrarse, el cliente recibe acceso gratuito equivalente al plan más básico de su rol por un número parametrizable de días (`pagos.freemium.duracion_dias`, default 30). Durante el freemium la suscripción está `ACTIVA` con `esFreemium=true`. Al vencer sin pago, el worker de vigencia (SPEC-213) transita a `SUSPENDIDA`. Si paga durante freemium, se desactiva la bandera y se extiende la vigencia desde `freemiumFechaFin`. Depende de SPEC-210, SPEC-213 y SPEC-215.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como nuevo cliente, quiero acceder gratis por 30 días al registrarme, para evaluar el servicio antes de pagar. | Must |
| US-002 | Como sistema, quiero evitar múltiples freemium por usuario, para no dar acceso gratuito indefinido. | Must |
| US-003 | Como cliente, quiero pagar durante el freemium y no perder los días restantes, para maximizar mi inversión. | Must |
| US-004 | Como sistema, quiero notificar al cliente T-7, T-1 y T=0, para que envíe su comprobante a tiempo. | Must |
| US-005 | Como cliente, quiero ver cuántos días de freemium me quedan, para planificar mi pago. | Should |

## Acceptance Scenarios

### AS-001 · Activación de freemium
**Given** un nuevo cliente (rector/padre) y `pagos.freemium.activo=true`  
**When** se crea su `Suscripcion`  
**Then** `estado=ACTIVA`, `esFreemium=true`, `freemiumFechaFin = now Bogotá + duracion_dias`.

### AS-002 · Plan básico asignado
**Given** un nuevo cliente  
**When** se activa freemium  
**Then** se asocia el plan más básico de su rol (`MES_1` del año actual).

### AS-003 · No múltiples freemium
**Given** un usuario que ya tuvo una suscripción freemium  
**When** intenta registrar una nueva suscripción  
**Then** no se activa freemium y la suscripción queda en estado que requiera pago.

### AS-004 · Pago durante freemium
**Given** una suscripción `ACTIVA` con `esFreemium=true` y `freemiumFechaFin` futura  
**When** admin autoriza un pago  
**Then** `esFreemium=false` y `fechaFin` se calcula desde `freemiumFechaFin` + duración del plan.

### AS-005 · Vencimiento sin pago
**Given** una suscripción `ACTIVA` con `esFreemium=true` y `freemiumFechaFin < hoy Bogotá`  
**When** corre el worker de vigencia  
**Then** pasa a `SUSPENDIDA` y se emite `suscripcion.freemium.terminado`.

### AS-006 · Notificaciones
**Given** una suscripción freemium  
**When** faltan 7, 1 o 0 días  
**Then** el worker programa los eventos `suscripcion.freemium.T_menos_7`, `T_menos_1`, `terminado`.

## Functional Requirements

- **FR-001**: Al crear una `Suscripcion` para un nuevo cliente, si `pagos.freemium.activo=true`, el sistema DEBE activar freemium.
- **FR-002**: El sistema DEBE asignar el plan más básico del rol (`Plan` con `tipoTitular` y `duracion=MES_1` del año actual).
- **FR-003**: El sistema DEBE calcular `freemiumFechaFin = fechaInicio + pagos.freemium.duracion_dias` en día calendario Bogotá.
- **FR-004**: El sistema DEBE rechazar un segundo freemium para el mismo usuario (por `usuarioId` o `colegioId`) histórico.
- **FR-005**: Al autorizar un pago durante freemium, el sistema DEBE:
  - Poner `esFreemium=false`.
  - Calcular `fechaFin` desde `freemiumFechaFin` si aún quedan días; de lo contrario, desde la fecha de autorización.
- **FR-006**: El worker de vigencia (SPEC-213) DEBE detectar freemium vencido y transitar a `SUSPENDIDA` emitiendo `suscripcion.freemium.terminado`.
- **FR-007**: El worker DEBE programar notificaciones T-7, T-1 y T=0 para suscripciones freemium.
- **FR-008**: El endpoint de consulta de suscripción DEBE incluir `esFreemium`, `freemiumFechaFin` y `diasRestantesFreemium` para consumo de SPEC-211.
- **FR-009**: El sistema DEBE registrar `AuditLog` en activación de freemium y en transición a suspendida.
- **FR-010**: Todo acceso a datos DEBE pasar por `PagosRepository`.

## Non-Functional Requirements

- **NFR-001**: Gate local completo.
- **NFR-002**: Tests de activación, pago durante freemium, vencimiento, anti-doble freemium.
- **NFR-003**: Logs con formato `[Freemium] <acción>: <suscripcionId> — <resultado>`.

## Success Criteria

- **SC-001**: Registro nuevo → `Suscripcion` con `estado=ACTIVA`, `esFreemium=true`, `freemiumFechaFin` correcto Bogotá.
- **SC-002**: Vista cliente muestra días restantes de freemium.
- **SC-003**: Simulación T-7 emite evento.
- **SC-004**: T+1 sin pago → `SUSPENDIDA` + evento `suscripcion.freemium.terminado`.
- **SC-005**: Usuario con freemium histórico → segundo registro NO activa freemium.
- **SC-006**: Pago durante freemium → `esFreemium=false` + vigencia extendida desde `freemiumFechaFin`.
- **SC-007**: CI 6/6 verde.

## Assumptions

- SPEC-210 dejó modelos y parámetros freemium.
- SPEC-213 programa las notificaciones y transita freemium vencido.
- SPEC-215 genera código de referido al crear suscripción; el orden de hooks no afecta.
- El plan básico `MES_1` existe para el rol del cliente.

## Decisiones propuestas / Deuda

1. **Identificación de histórico**: se usa `usuarioId` para padres y `colegioId` para rectores; si un colegio cambia de rector, el nuevo rector hereda la historia del colegio.
2. **Pago durante freemium**: extensión desde `freemiumFechaFin`; si ya venció, desde fecha de autorización (sin prorrateo).
3. **Plan básico**: `MES_1` del año actual. Si no existe, se loggea error y no se activa freemium.
4. **Deuda técnica**: la lógica de activación debe ubicarse en el servicio de creación de suscripción compartido por registro de cliente y creación admin.

## Implementación

Cerrada el 2026-08-24 (rama `work/002-PI-mega-cola-restante`). Detalle en `cierre.md`.

- Servicio: `src/lib/pagos/freemium.service.ts` (`crearSuscripcionCliente` = servicio compartido de creación, Deuda 4; `extenderVigenciaDesdeFreemium` = hook `pago.autorizado`); cálculos puros en `src/lib/pagos/freemium-calculos.ts`; parámetros en `src/lib/pagos/parametros-pagos.ts`.
- DAL: `src/lib/dal/repositories/pagos-freemium-repository.ts` (nuevo; `pagos-repository.ts` intacto por max-lines).
- Hook de autorización: `src/app/api/admin/pagos/pendientes/[id]/autorizar/route.ts` (fail-open, tras el hook de referidos).
- Endpoint cliente: `VistaSuscripcion` expone `esFreemium` + `freemiumFechaFin` + `diasRestantesFreemium` (FR-008); `SuscripcionResumen` muestra los días restantes (SC-002).
- Migración `20260824100000_spec_217_freemium` (aditiva): 3 índices + 2 valores de `AccionAudit`.
- Hallazgo preexistente corregido: `existeCodigoReferidoPropio` (SPEC-215) no existía en ningún repositorio y rompía `tsc` en todo el árbol; se añadió a `PagosReferidosRepository` y se corrigieron dos fixtures de tests de SPEC-215 sin el obligatorio `codigoReferidoPropio`.
