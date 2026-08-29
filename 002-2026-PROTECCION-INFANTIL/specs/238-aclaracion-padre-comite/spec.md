# Feature Specification: SPEC-238 — Aclaración padre-comité (1 iteración máx)

**Feature Branch**: `work/002-pi-padre-lote-core`

**Created**: 2026-08-22

**Status**: PLANEADO

Impacto en arquitectura: añade modelo `AclaracionExpediente` (migración aditiva), repositorio DAL `aclaracion-repository.ts`, tres endpoints (`pedir-aclaracion`, `responder`, `cerrar-forzoso`), extensión del worker `pi-expediente-motor` (SPEC-236, D-72) para vigilar SLA de aclaraciones pendientes, y tests de concurrencia, guardas de rol, transacciones atómicas e idempotencia.

**Input**: Cuando un expediente llega a `EN_APROBACION_PADRE`, el padre titular necesita poder pedir UNA aclaración al comité antes de aprobar. El comité responde y el expediente vuelve a `EN_APROBACION_PADRE`. Si el comité no responde dentro del SLA configurable, el sistema cierra la aclaración forzosamente y transita el expediente a `CERRADO`. Solo una aclaración por expediente; no hay segunda ronda.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Padre pide una aclaración (Priority: P1)

Como padre titular de un expediente en `EN_APROBACION_PADRE`, quiero escribir una pregunta al comité para aclarar dudas antes de aprobar, para no quedarme sin entender el informe.

**Why this priority**: es el gatillo del flujo; sin él no hay iteración padre-comité.

**Independent Test**: autenticarse como PARENT propietario, llamar `POST /api/padre/expediente/[id]/pedir-aclaracion` con un texto claro, y verificar que se crea `AclaracionExpediente` en estado `PENDIENTE`, el expediente pasa a `EN_ACLARACION` y se publica el evento `expediente.aclaracion.solicitada`.

**Acceptance Scenarios**:

1. **Given** un expediente en `EN_APROBACION_PADRE` y el usuario autenticado es el padre titular, **When** envía un texto de aclaración válido, **Then** se crea exactamente una aclaración `PENDIENTE`, el expediente pasa a `EN_ACLARACION` y ambas operaciones ocurren en la misma transacción.
2. **Given** un expediente que ya tiene una aclaración (cualquier estado), **When** el padre intenta pedir otra, **Then** recibe `409 Conflict` y no se crea segunda fila (garantía `@@unique([expedienteId])`).
3. **Given** un expediente en estado distinto a `EN_APROBACION_PADRE`, **When** el padre pide aclaración, **Then** recibe `409 Conflict`.
4. **Given** un usuario autenticado que no es el padre titular del expediente, **When** intenta pedir aclaración, **Then** recibe `403 Forbidden`.
5. **Given** un texto de aclaración vacío o mayor a 2000 caracteres, **When** se envía, **Then** recibe `400 Bad Request` antes de tocar la BD.

---

### User Story 2 — Comité responde la aclaración (Priority: P1)

Como miembro del comité de validación, quiero responder la aclaración de un padre para que el expediente vuelva a `EN_APROBACION_PADRE` y el padre pueda cerrar.

**Why this priority**: cierra el ciclo de comunicación y permite la resolución del expediente.

**Independent Test**: autenticarse como `COMITE_VALIDACION`, llamar `POST /api/admin/comite/aclaracion/[id]/responder` con texto de respuesta, y verificar que `respondidaEn`, `respondidaPor` y `respuestaTexto` se guardan, el estado cambia a `RESPONDIDA`, el expediente vuelve a `EN_APROBACION_PADRE` y se publica `expediente.aclaracion.respondida`.

**Acceptance Scenarios**:

1. **Given** una aclaración `PENDIENTE`, **When** un usuario `COMITE_VALIDACION` (mismo tenant) responde con texto válido, **Then** la aclaración pasa a `RESPONDIDA`, el expediente pasa a `EN_APROBACION_PADRE` y ambas operaciones son atómicas.
2. **Given** una aclaración ya `RESPONDIDA` o `CERRADA_FORZOSAMENTE`, **When** se intenta responder de nuevo, **Then** recibe `409 Conflict`.
3. **Given** un usuario sin rol `COMITE_VALIDACION`, **When** intenta responder, **Then** recibe `403 Forbidden`.
4. **Given** un comité de otro tenant/colegio, **When** intenta responder una aclaración a la que no tiene acceso, **Then** recibe `404 Not Found`.
5. **Given** una respuesta vacía o mayor a 2000 caracteres, **When** se envía, **Then** recibe `400 Bad Request`.

---

### User Story 3 — Padre cierra el expediente tras respuesta (Priority: P1)

Como padre titular, quiero cerrar el expediente una vez que el comité respondió (o si el sistema forzó el cierre por SLA vencido), para finalizar el proceso.

**Why this priority**: es la última acción del padre sobre el expediente.

**Independent Test**: con una aclaración `RESPONDIDA` y expediente en `EN_APROBACION_PADRE`, llamar `POST /api/padre/expediente/[id]/cerrar-forzoso` como padre titular y verificar que la aclaración pasa a `CERRADA_FORZOSAMENTE` y el expediente pasa a `CERRADO`.

**Acceptance Scenarios**:

1. **Given** un expediente en `EN_APROBACION_PADRE` con aclaración `RESPONDIDA`, **When** el padre titular cierra, **Then** la aclaración pasa a `CERRADA_FORZOSAMENTE` y el expediente pasa a `CERRADO` en una transacción.
2. **Given** un expediente en `EN_APROBACION_PADRE` con aclaración `CERRADA_FORZOSAMENTE`, **When** se vuelve a llamar cerrar, **Then** es idempotente (200 sin cambios de estado).
3. **Given** un expediente en `EN_APROBACION_PADRE` sin aclaración o con aclaración `PENDIENTE`, **When** el padre intenta cerrar, **Then** recibe `409 Conflict`.
4. **Given** un usuario que no es el padre titular, **When** intenta cerrar, **Then** recibe `403 Forbidden`.

---

### User Story 4 — Worker fuerza el cierre por SLA vencido (Priority: P1)

Como sistema, quiero detectar aclaraciones `PENDIENTE` que superaron el SLA configurado y forzar el cierre del expediente, para que un caso no se quede atascado esperando respuesta del comité.

**Why this priority**: evita casos huérfanos cuando el comité no responde.

**Independent Test**: crear una aclaración `PENDIENTE` con `solicitadaEn` anterior al SLA, ejecutar el tick del worker `pi-expediente-motor` y verificar que publica `expediente.comite.sla_vencido` y que, como consecuencia, la aclaración pasa a `CERRADA_FORZOSAMENTE` y el expediente a `CERRADO`.

**Acceptance Scenarios**:

1. **Given** una aclaración `PENDIENTE` cuya `solicitadaEn` + `padre.comite.sla_horas_normal` (horas) es anterior a ahora en zona Bogotá, **When** el worker `pi-expediente-motor` ejecuta su tick, **Then** publica el evento `expediente.comite.sla_vencido` con el id del expediente y la aclaración.
2. **Given** el evento `expediente.comite.sla_vencido`, **Then** el worker (o handler interno con `X-Worker-Secret`) invoca el cierre forzoso: aclaración `CERRADA_FORZOSAMENTE` y expediente `CERRADO`.
3. **Given** una aclaración `PENDIENTE` que aún no vence, **When** corre el tick, **Then** no publica el evento.
4. **Given** una aclaración `RESPONDIDA` o `CERRADA_FORZOSAMENTE`, **When** corre el tick, **Then** la ignora.

---

### Edge Cases

- **Máxima una aclaración por expediente**: la base de datos garantiza `@@unique([expedienteId])`; las carreras concurrentes terminan en `409` para el perdedor.
- **Transición fallida dentro de la transacción**: si `aplicarTransicion` rechaza el cambio de estado, se hace rollback completo: no queda aclaración huérfana ni expediente cambiado parcialmente.
- **Cierre forzoso ya realizado**: el endpoint es idempotente; no devuelve error si el estado ya es `CERRADO` y la aclaración `CERRADA_FORZOSAMENTE`.
- **SLA cambiado en caliente**: el worker siempre lee el parámetro `padre.comite.sla_horas_normal` en cada tick; cambios futuros afectan solo aclaraciones no vencidas aún.
- **Hora del servidor vs. Bogotá**: el cálculo de vencimiento usa `America/Bogota` para comparar `solicitadaEn + SLA < now()`; la BD almacena `Timestamptz(6)`.
- **Comité con rol `COMITE_VALIDACION` de plataforma**: debe poder responder aclaraciones de cualquier tenant; la validación de acceso se hace sobre el expediente/aclaración, no sobre `tenantId` del comité. Si el rol es por colegio (SPEC-168), se restringe al mismo `colegioId`.
- **Texto original protegido**: la aclaración contiene texto sensible; los logs de auditoría solo almacenan metadatos (`id`, `estado`, `expedienteId`), nunca el texto completo.
- **Evento perdido**: el worker publica el evento best-effort vía pg-boss; si la cola falla, el error se loguea pero el cierre forzoso de la BD ya quedó aplicado (eventual consistencia del evento).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el modelo `AclaracionExpediente` exactamente como el brief §7.4: `id`, `expedienteId` (FK), `informeConsolidadoId` (FK), `solicitadaEn` `DateTime` `@db.Timestamptz(6)` `@default(now())`, `solicitudTexto` `@db.Text`, `respondidaEn` `DateTime?` `@db.Timestamptz(6)`, `respondidaPor` `String?` (FK `Usuario`), `respuestaTexto` `@db.Text?`, `estado` `String` (`PENDIENTE|RESPONDIDA|CERRADA_FORZOSAMENTE`), `createdAt` `DateTime` `@db.Timestamptz(6)`, `@@unique([expedienteId])`.
- **FR-002**: El sistema DEBE implementar el repositorio DAL `src/lib/dal/repositories/aclaracion-repository.ts` que exponga métodos transaccionales para crear, buscar por `expedienteId`, buscar por `id`, responder y marcar como cerrada forzosamente (cumple Q-3).
- **FR-003**: El sistema DEBE exponer `POST /api/padre/expediente/[id]/pedir-aclaracion` autenticado como `PARENT` propietario del expediente, validando que el expediente esté en `EN_APROBACION_PADRE` y que no exista aclaración previa, e insertando una fila `PENDIENTE` mientras aplica `aplicarTransicion(..., 'EN_ACLARACION', ...)` dentro de una transacción.
- **FR-004**: El sistema DEBE exponer `POST /api/admin/comite/aclaracion/[id]/responder` autenticado como `COMITE_VALIDACION`, validando que la aclaración esté `PENDIENTE`, guardando `respuestaTexto`, `respondidaPor`, `respondidaEn` y `estado=RESPONDIDA`, y aplicando `aplicarTransicion(..., 'EN_APROBACION_PADRE', ...)` dentro de una transacción.
- **FR-005**: El sistema DEBE exponer `POST /api/padre/expediente/[id]/cerrar-forzoso` usable por el padre titular o por el worker post-SLA, validando que el expediente esté en `EN_APROBACION_PADRE` con aclaración en `RESPONDIDA` o `CERRADA_FORZOSAMENTE`, y aplicando la transición a `CERRADO` dentro de una transacción.
- **FR-006**: El worker `pi-expediente-motor` (SPEC-236) DEBE extender su tick para observar aclaraciones `PENDIENTE` cuya `solicitadaEn` + `padre.comite.sla_horas_normal` sea anterior a `now()` en Bogotá, y publicar el evento `expediente.comite.sla_vencido` (sin crear un worker nuevo, D-72).
- **FR-007**: El sistema DEBE publicar los eventos `expediente.aclaracion.solicitada` (al crear) y `expediente.aclaracion.respondida` (al responder) vía el bus de eventos de SPEC-236 (ya sembrados).
- **FR-008**: El sistema DEBE registrar en `AuditLog` las acciones `ACLARACION_SOLICITADA`, `ACLARACION_RESPONDIDA` y `ACLARACION_CERRADA_FORZOSAMENTE` con metadatos (`id`, `expedienteId`, `informeConsolidadoId`, `estado`) sin incluir textos.
- **FR-009**: El sistema DEBE ejecutar los endpoints con transacciones atómicas: crear/responder/cerrar aclaración + `aplicarTransicion` en la misma unidad de trabajo.
- **FR-010**: El sistema DEBE rechazar textos de solicitud o respuesta vacíos o mayores a 2000 caracteres con `400 Bad Request`.
- **FR-011**: El sistema DEBE implementar tests de: concurrencia de dos solicitudes (una gana, la otra `409`), guardas de rol, atomicidad de transacciones, cálculo de SLA en Bogotá, cierre forzoso y idempotencia del cierre.
- **FR-012**: El sistema DEBE usar migración aditiva, `@db.Timestamptz(6)` y no modificar `src/lib/ai/**` ni crear un worker nuevo.

### Key Entities

- **AclaracionExpediente**: una única aclaración posible por expediente; estados `PENDIENTE`, `RESPONDIDA`, `CERRADA_FORZOSAMENTE`.
- **Expediente**: entidad padre; estados relevantes `EN_APROBACION_PADRE`, `EN_ACLARACION`, `CERRADO`.
- **InformeConsolidado**: vinculado a la aclaración para trazabilidad del informe que el padre estaba aprobando.
- **Usuario**: `respondidaPor` referencia al miembro del comité que respondió; el padre titular se obtiene del expediente.
- **AuditLog**: registra cambios de estado sin textos completos.
- **ParametroSistema**: clave `padre.comite.sla_horas_normal` (entero, horas) definida en SPEC-236/237.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una petición de aclaración válida retorna `201` y crea exactamente una fila; una segunda petición concurrente retorna `409`.
- **SC-002**: Una respuesta de comité válida retorna `200`, deja la aclaración en `RESPONDIDA` y el expediente en `EN_APROBACION_PADRE`.
- **SC-003**: El cierre forzoso retorna `200`, deja la aclaración en `CERRADA_FORZOSAMENTE` y el expediente en `CERRADO`; una segunda llamada retorna `200` sin cambios.
- **SC-004**: El worker detecta vencimiento de SLA con zona horaria `America/Bogota` y publica `expediente.comite.sla_vencido` para cada aclaración vencida.
- **SC-005**: Los eventos `expediente.aclaracion.solicitada` y `expediente.aclaracion.respondida` se publican al crear y responder respectivamente.
- **SC-006**: El gate local completo (`tsc`, `lint`, `test`, `build`, `arch:check`) queda verde.

---

## Assumptions

- SPEC-236 entrega `Expediente`, `InformeConsolidado`, la máquina de estados `aplicarTransicion`, el worker `scripts/pi-expediente-motor.mjs`, el bus de eventos con `expediente.aclaracion.solicitada`, `expediente.aclaracion.respondida` y el parámetro `padre.comite.sla_horas_normal`.
- SPEC-237 entrega la bandeja del comité, la asignación de miembros y los permisos de acceso por tenant/colegio.
- El rol `COMITE_VALIDACION` ya existe en `RolUsuario` y puede responder aclaraciones (acceso cross-tenant o restringido por colegio según SPEC-237).
- El padre titular es el `Usuario` con rol `PARENT` vinculado al expediente (campo `padreUsuarioId` definido en SPEC-230).
- El cierre forzoso por SLA puede ser invocado por el worker usando un mecanismo interno (evento + handler o llamada directa al servicio con `X-Worker-Secret`); la UI del padre no es necesaria para este caso.
- La UI de respuesta del comité es mínima (`/admin/comite/aclaracion/[id]`); la UI del padre (SPEC-232) está fuera de alcance.
- No se modifica `src/lib/ai/**`; la aclaración es texto plano y no requiere clasificación.
- Las migraciones son aditivas y no destructivas; no se borran datos ni se alteran tablas existentes.

---

## Implementación *(pendiente)*

*Esta sección se completa al cerrar la spec tras la implementación y el gate local.*
