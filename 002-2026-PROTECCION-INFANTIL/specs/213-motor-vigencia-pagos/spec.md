# SPEC-213 · Motor vigencia + estados (002-PI-113)

> Status: `PLANEADO`
> PI: 002-PI-113
> Responsable: ODIN
> Rama: `work/002-PI-pagos-planes-lote3`
> Base: `feature/001-scaffolding`

## Contexto

Worker de transiciones automáticas de la máquina de estados del Módulo Pagos. Evalúa diariamente las suscripciones y ejecuta las transiciones `ACTIVA → EN_GRACIA` (día 0), `EN_GRACIA → SUSPENDIDA` (día +3), y las transiciones relacionadas con freemium. Emite los 18 eventos del BRIEF §10 al Motor de Notificaciones (SPEC-201) y registra cada transición en `AuditLog`. Depende de SPEC-210 (modelos) y del Motor de Notificaciones (SPEC-201).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como sistema, quiero ejecutar un worker diario que evalúe vigencias, para aplicar transiciones de estado automáticas sin intervención humana. | Must |
| US-002 | Como admin, quiero que el corte por mora sea automático a T+3, para que "no haya pago = no haya acceso" sin depender de un proceso manual. | Must |
| US-003 | Como sistema, quiero emitir recordatorios y alertas en los momentos exactos (T-5, T-1, T=0, T+2, T+3), para notificar a clientes y admin. | Must |
| US-004 | Como auditor, quiero que cada transición de estado quede en `AuditLog` con `usuarioId=SYSTEM`, para trazabilidad. | Must |
| US-005 | Como operador, quiero que el worker sea idempotente (una sola corrida efectiva por día), para evitar notificaciones duplicadas. | Must |

## Acceptance Scenarios

### AS-001 · Transición ACTIVA → EN_GRACIA
**Given** una suscripción `ACTIVA` con `fechaFin = hoy Bogotá`  
**When** corre el worker  
**Then** la suscripción pasa a `EN_GRACIA`, se actualiza `fechaCorteProgramado` y se emite `suscripcion.vencida.T_0`.

### AS-002 · Transición EN_GRACIA → SUSPENDIDA
**Given** una suscripción `EN_GRACIA` con `fechaCorteProgramado = hoy Bogotá`  
**When** corre el worker  
**Then** la suscripción pasa a `SUSPENDIDA`, se registra `suspendidaEn` y se emite `suscripcion.cortada.T_mas_3`.

### AS-003 · Reactivación manual
**Given** una suscripción `SUSPENDIDA`  
**When** un admin autoriza un pago  
**Then** la suscripción vuelve a `ACTIVA`, se recalcula `fechaFin` y se emite `suscripcion.reactivada`.

### AS-004 · Freemium terminado
**Given** una suscripción `ACTIVA` con `esFreemium=true` y `freemiumFechaFin < hoy Bogotá`  
**When** corre el worker  
**Then** la suscripción pasa a `SUSPENDIDA` y se emite `suscripcion.freemium.terminado`.

### AS-005 · Idempotencia
**Given** una suscripción lista para transitar  
**When** el worker corre dos veces el mismo día  
**Then** la segunda corrida no genera eventos duplicados ni cambios adicionales.

### AS-006 · Notificaciones programadas
**Given** suscripciones con fechas relevantes en los próximos días  
**When** el worker evalúa el calendario  
**Then** programa eventos `suscripcion.por_vencer.T_menos_5`, `T_menos_1`, `suscripcion.gracia.T_mas_2`, etc.

## Functional Requirements

- **FR-001**: El sistema DEBE crear `scripts/worker-vigencia-pagos.mjs` con advisory lock de PostgreSQL (ID exclusivo).
- **FR-002**: El sistema DEBE agregar el servicio `pi-vigencia` en `docker-compose.yml` y `docker-compose.prod.yml` con `TZ: America/Bogota`, dependencia de `db` y `app`.
- **FR-003**: El worker DEBE ejecutarse diariamente a la hora configurable en `ParametroSistema` (`pagos.vigencia.hora_corrida`, default `01:00`).
- **FR-004**: El worker DEBE usar `date-fns-tz` con `America/Bogota` para toda comparación de fechas.
- **FR-005**: El worker DEBE implementar la máquina de estados del BRIEF §6 sin inventar transiciones:
  - `ACTIVA → EN_GRACIA` al llegar a `fechaFin`.
  - `EN_GRACIA → SUSPENDIDA` al llegar a `fechaFin + pagos.gracia_dias`.
  - `EN_GRACIA → ACTIVA` al autorizar pago (manual, no del worker).
  - `SUSPENDIDA → ACTIVA` al autorizar pago (manual).
  - `ACTIVA/EN_GRACIA → CANCELADA` por acción de usuario o admin.
  - Freemium: `ACTIVA (esFreemium=true) → SUSPENDIDA` si `freemiumFechaFin < hoy`.
- **FR-006**: Cada transición automática DEBE registrarse en `AuditLog` con `usuarioId=SYSTEM`, `accion`, `suscripcionId` y metadatos.
- **FR-007**: El worker DEBE emitir los 18 eventos del BRIEF §10 vía `motor.programar()` cuando corresponda.
- **FR-008**: El worker DEBE ser idempotente: debe registrar `ultimaCorrida` (en `ParametroSistema` o tabla de control) y no repetir transiciones ya aplicadas en el mismo día.
- **FR-009**: El worker DEBE procesar suscripciones en lotes (paginación) para no saturar memoria.
- **FR-010**: El worker NO DEBE recalcular pagos ni tocar vistas; solo transita estados y emite eventos.
- **FR-011**: Todo acceso a datos DEBE pasar por `PagosRepository`.
- **FR-012**: Si el Motor de Notificaciones no está disponible, el worker DEBE loggear warning y continuar (fail-open para notificaciones, no para transiciones).

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **NFR-002**: Tests de integración que simulen transiciones e idempotencia.
- **NFR-003**: Logs con formato `[Vigencia] <transición>: <suscripcionId> — <resultado>`.
- **NFR-004**: Docker healthcheck para `pi-vigencia`.

## Success Criteria

- **SC-001**: Worker corre con advisory lock; segundo intento devuelve código 2.
- **SC-002**: `docker-compose*.yml` incluyen `pi-vigencia` con `TZ=America/Bogota`.
- **SC-003**: Simulación `ACTIVA → EN_GRACIA` + emite `suscripcion.vencida.T_0`.
- **SC-004**: Dos corridas el mismo día generan una sola emisión por suscripción.
- **SC-005**: Freemium vencido transita a `SUSPENDIDA` + evento `suscripcion.freemium.terminado`.
- **SC-006**: `AuditLog` registra cada transición con `usuarioId=SYSTEM`.
- **SC-007**: CI 6/6 verde.

## Assumptions

- SPEC-210 dejó los modelos `Suscripcion`, `Pago`, `ParametroSistema` y `AuditLog` listos.
- El Motor de Notificaciones (SPEC-201) expone `motor.programar()` y tiene las 18 reglas/plantillas sembradas.
- El timezone `America/Bogota` ya está configurado en contenedores (D-69 / SPEC-INFRA-TIMEZONE).
- Los pagos manuales son autorizados por admin en otra SPEC (SPEC-212); este worker no autoriza pagos.

## Decisiones propuestas / Deuda

1. **Control de idempotencia**: usar `ParametroSistema.pagos.vigencia.ultima_corrida` con fecha Bogotá; si ya es hoy, el worker termina sin acciones.
2. **Programación de notificaciones futuras**: el worker evalúa T-5, T-1, T+2 y programa eventos correspondientes si aún no están programados.
3. **Dependencia motor notif**: si al arrancar falta alguna regla del catálogo §10, se documenta como bloqueo y se aborta hasta que SPEC-201/seed la agregue.
4. **Deuda técnica**: la hora de corrida es global; no se soporta horario por tenant en v1.
