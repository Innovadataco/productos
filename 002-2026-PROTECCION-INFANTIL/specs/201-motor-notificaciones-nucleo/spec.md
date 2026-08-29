> DEPENDE DE: SPEC-200 (timezone Bogotá). No implementar antes de que SPEC-200 esté aprobada y estable.

# Feature Specification: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098)

**Feature Branch**: `work/002-PI-motor-notif-lote1`

**Created**: 2026-08-22

**Status**: `PLANEADO`

**Input**: 002-PI-098. Construir el motor de notificaciones transaccional descrito en [BRIEF-MOTOR-NOTIFICACIONES.md](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MOTOR-NOTIFICACIONES.md). El motor es 100% lógica, sin IA, determinista; vive como módulo interno en `src/lib/notificaciones/` con API pública estricta. Es prerequisito de SPEC-202 (panel admin), SPEC-203 (preferencias usuario) y SPEC-204 (piloto bienvenida colegio).

Objetivo: implementar el núcleo del motor con modelos Prisma, repositorios DAL, API pública (`programar`, `cancelar`, `estado`, `recalcular`), worker `pi-notificaciones`, seed de reglas/parámetros, gestión de bounces y quiet hours. El motor debe poder encolar/enviar notificaciones email e in-app, respetar opt-out (salvo transaccionales), ventana de silencio y reintentos configurables.

Impacto en arquitectura: nuevo schema Prisma (5 modelos), módulo `src/lib/notificaciones/`, nuevo worker `scripts/worker-notificaciones.mjs`, servicio `pi-notificaciones` en `docker-compose.prod.yml`, cambios en `prisma/seed.ts`. No se toca `src/lib/ai/**`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Modelos de datos del motor (Priority: P1)

Como sistema quiero tablas dedicadas para cola, plantillas, reglas, preferencias y bounces, para que el motor sea auditabl5e y configurable sin deploys.

**Why this priority**: es la base de todo el motor.

**Independent Test**: `prisma migrate dev` genera las 5 tablas sin errores; seed inserta reglas semilla.

**Acceptance Scenarios**:

1. **Given** `prisma/schema.prisma`, **When** se inspeccionan los modelos, **Then** existen `Notificacion`, `NotificacionPlantilla`, `NotificacionRegla`, `NotificacionPreferencia` y `NotificacionContactoBloqueado` según el BRIEF §5.
2. **Given** la migración generada, **When** se aplica, **Then** crea tablas e índices sin tocar datos existentes.
3. **Given** `prisma/seed.ts`, **When** corre, **Then** inserta las 6 reglas semilla del BRIEF §6 y los parámetros del BRIEF §5.6.

### User Story 2 — API pública del motor (Priority: P1)

Como desarrollador quiero una API interna clara para programar, cancelar, consultar estado y recalcular notificaciones, para que ningún otro módulo escriba directamente en las tablas del motor.

**Why this priority**: mantiene la integridad del motor y centraliza la lógica.

**Independent Test**: tests de integración de `src/lib/notificaciones/motor.ts`.

**Acceptance Scenarios**:

1. **Given** una llamada a `programar({ evento: "suscripcion.por_vencer", destinatarios: [...] })`, **When** hay reglas activas para ese evento, **Then** se crean filas `Notificacion` en estado `ENCOLADA` con `enviarEn` calculado según offset y quiet hours.
2. **Given** una llamada a `cancelar({ evento, sujetoId })`, **When** existen notificaciones programadas, **Then** se marcan `CANCELADA` con el motivo correspondiente.
3. **Given** una llamada a `estado(id)`, **When** la notificación existe, **Then** devuelve la fila completa.
4. **Given** una llamada a `recalcular({ evento })`, **When** cambian los offsets de una regla, **Then** reprograma las notificaciones afectadas y devuelve conteo.

### User Story 3 — Worker de notificaciones (Priority: P1)

Como operador quiero un worker dedicado que consuma la cola y envíe notificaciones por email o in-app, para que el envío sea asíncrono y tolerante a fallos.

**Why this priority**: desacopla encolamiento de envío y permite reintentos.

**Independent Test**: el worker levanta, consulta la cola con advisory lock y procesa un lote.

**Acceptance Scenarios**:

1. **Given** una notificación `ENCOLADA` con `enviarEn <= ahora` y fuera de quiet hours, **When** el worker hace poll, **Then** la marca `ENVIANDO`, envía email/in-app, y marca `ENVIADA`/`FALLIDA` según resultado.
2. **Given** una notificación programada dentro de quiet hours, **When** el worker la evalúa, **Then** no la envía hasta salir de la ventana.
3. **Given** un email con hard bounce, **When** el worker procesa el fallo, **Then** incrementa contador y, superado el umbral, bloquea el contacto.
4. **Given** un segundo worker, **When** intenta arrancar, **Then** el advisory lock lo hace salir con código 2 (igual que worker-reportes).

### User Story 4 — Quiet hours y reintentos (Priority: P1)

Como admin quiero definir horario de no molestar y backoff de reintentos, para respetar a los usuarios y recuperarme de fallos transitorios.

**Why this priority**: requisito de usabilidad y confiabilidad.

**Independent Test**: tests con horario de quiet hours y simulación de fallos.

**Acceptance Scenarios**:

1. **Given** `notificaciones.horario.silencio = "20:00-07:00"`, **When** una notificación se programaría a las 21:00 Bogotá, **Then** se desplaza a las 07:00 del día siguiente.
2. **Given** una notificación `FALLIDA` con intentos < max_intentos, **When** pasa el backoff correspondiente, **Then** el worker la reintenta.
3. **Given** una notificación `FALLIDA` con intentos >= max_intentos, **When** el worker la evalúa, **Then** la deja `FALLIDA` definitiva y registra `ultimoError`.

### User Story 5 — Preferencias y opt-out (Priority: P1)

Como usuario quiero poder desactivar notificaciones no transaccionales; como sistema quiero que las transaccionales siempre lleguen.

**Why this priority**: cumple Ley 1581 y requisito del BRIEF.

**Independent Test**: test de preferencia habilitada/deshabilitada vs `obligatoria: true`.

**Acceptance Scenarios**:

1. **Given** una regla con `obligatoria: true`, **When** se dispara, **Then** siempre se programa sin consultar preferencias.
2. **Given** una regla no obligatoria, **When** el usuario deshabilitó la preferencia, **Then** no se programa (o se cancela).
3. **Given** una regla no obligatoria, **When** no existe preferencia explícita, **Then** se asume habilitada (opt-out).

### User Story 6 — Bounces y contactos bloqueados (Priority: P2)

Como admin quiero que los emails que rebotan sean rastreados y bloqueados tras N intentos, para no dañar reputación de envío.

**Why this priority**: salud del motor y cumplimiento de buenas prácticas.

**Independent Test**: test de incremento de bounce y bloqueo tras umbral.

**Acceptance Scenarios**:

1. **Given** un envío email que falla con hard bounce, **When** se registra el fallo, **Then** se incrementa `bounceCount` del contacto.
2. **Given** un contacto con `bounceCount >= umbral_bloqueo`, **When** se intenta enviar nuevamente, **Then** se cancela con motivo `contacto_bloqueado`.
3. **Given** un webhook de Resend con evento bounce, **When** llega con `proveedorId` conocido, **Then** actualiza estado y contador (idempotente).

---

## Functional Requirements

FR-001: El schema Prisma DEBE incluir los modelos `Notificacion`, `NotificacionPlantilla`, `NotificacionRegla`, `NotificacionPreferencia` y `NotificacionContactoBloqueado` según el BRIEF §5, con índices declarados.

FR-002: El seed DEBE crear las 6 reglas semilla del BRIEF §6 y los 6 parámetros del BRIEF §5.6.

FR-003: El módulo `src/lib/notificaciones/` DEBE exportar una API pública con `programar`, `cancelar`, `estado` y `recalcular`, con las firmas del BRIEF §7.

FR-004: `programar` DEBE leer reglas activas por `evento`, calcular `enviarEn` usando `date-fns-tz` en `America/Bogota` con offset ISO8601, aplicar quiet hours, filtrar por preferencias (salvo obligatorias), y crear notificaciones `ENCOLADA`.

FR-005: `cancelar` DEBE marcar `CANCELADA` las notificaciones programadas según criterios, con `motivoCancelacion` documentado.

FR-006: `recalcular` DEBE cancelar notificaciones programadas de un evento y volver a programarlas con la regla actual.

FR-007: El worker `scripts/worker-notificaciones.mjs` DEBE usar advisory lock de PostgreSQL, consultar la cola con `LIMIT` configurable, respetar quiet hours, enviar email vía Resend o in-app vía repositorio, y actualizar estados con reintentos.

FR-008: El worker DEBE registrar `proveedorId` de Resend, y los webhooks DEBEN actualizar estados (`ENVIADA`, `ABIERTA`, `CLICADA`, `FALLIDA`, bounced) de forma idempotente por `proveedorId`.

FR-009: Las notificaciones in-app DEBEN reutilizar/integrarse con la bandeja existente (`NotificacionInApp` / `CentroNotificaciones`) o crear una bandeja unificada según decisión de implementación; en cualquier caso, el usuario ve notificaciones del motor en el centro de notificaciones.

FR-010: El motor DEBE registrar `AuditLog` en mutaciones críticas (programar masivo, cancelar masivo, recalcular, bloqueo por bounce) sin incluir texto sensible.

FR-011: `docker-compose.prod.yml` DEBE incluir el servicio `pi-notificaciones` con advisory lock, `TZ: America/Bogota` y dependencias de `db` y `app`.

FR-012: Todo cálculo temporal del motor DEBE usar `date-fns-tz` con `America/Bogota` (heredado de SPEC-200).

FR-013: No se DEBE tocar `src/lib/ai/**`.

---

## Success Criteria

- 5 modelos Prisma creados con índices; migración aditiva aplica sin errores.
- Seed crea reglas y parámetros; `programar` genera notificaciones `ENCOLADA` correctas.
- Worker envía email e in-app; reintentos y quiet hours funcionan.
- Bounce incrementa y bloquea tras umbral.
- API pública usada por al menos un dominio (SPEC-204).
- CI verde 6/6.

---

## Assumptions

- SPEC-200 ya aprobada e implementada (timezone, `date-fns-tz`, `Timestamptz(6)`).
- Se reutiliza Resend como proveedor email (ya configurado en `src/lib/email.ts`).
- Las notificaciones in-app pueden coexistir con `NotificacionInApp` existente; la implementación decide si unifica o mantiene separación mientras el centro de notificaciones las muestre.
- Los webhooks de Resend se exponen en SPEC-202 o en esta SPEC según planificación; la API de webhook es parte del núcleo.
- El motor corre como un solo proceso a la vez (advisory lock); no se escala horizontalmente en v1.

---

## Implementación

Ver `plan.md` y `tasks.md`. Se completará tras aprobación de ZEUS.
