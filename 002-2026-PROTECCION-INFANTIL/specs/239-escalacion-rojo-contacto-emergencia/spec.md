# Feature Specification: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

**Feature Branch**: `work/002-pi-padre-lote-core`

**Created**: 2026-08-22

**Status**: `IMPLEMENTADO`

Impacto en arquitectura: añade modelo `ContactoEmergencia` (migración aditiva), repositorio DAL `contacto-emergencia-repository`, extensión de `expediente-repository` con `marcarEscaladoRojo()`, handler del evento `expediente.gravedad.subio_a_rojo`, endpoint `POST /api/admin/comite/expediente/[id]/activar-emergencia`, CRUD de contactos bajo `/api/padre/contacto-emergencia`, extensión del worker `pi-expediente-motor` (SPEC-236/D-72) para vigilar SLA 12h de casos ROJO, y botón "activar emergencia" en la vista `/admin/comite/consolidacion/[id]` (SPEC-237). Añade evento `expediente.emergencia.activada` y plantilla urgente en el catálogo del Motor Notif.

**Input**: Cuando un caso sube a gravedad ROJO, el sistema debe comprometer un SLA efectivo de 12h, alertar administrativamente y, si el comité activa la emergencia, contactar al acudiente de mayor prioridad registrado por el padre. Los contactos de emergencia los administra el propio padre; el comité solo los consulta y dispara la notificación.

**Dependencias**: SPEC-236 (motor de estados + worker `pi-expediente-motor` + eventos), SPEC-237 (vista de consolidación del comité), SPEC-232 (consume el CRUD de contactos en UI padre, fuera de scope aquí).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Padre administra contactos de emergencia (Priority: P1)

Como padre quiero registrar, ordenar por prioridad y mantener activos/inactivos los contactos de emergencia de mi hijo, para que el comité sepa a quién llamar o escribir si un caso llega a gravedad ROJO.

**Why this priority**: sin contactos vigentes y ordenados, la activación de emergencia no tiene receptor; es prerrequisito del resto del flujo.

**Independent Test**: un padre autenticado crea 3 contactos con prioridades 1, 2 y 3; edita el teléfono del primero; otro padre no ve ni puede mutar esos contactos.

**Acceptance Scenarios**:

1. **Given** un padre autenticado, **When** envía `POST /api/padre/contacto-emergencia` con `nombre`, `relacion` (`MADRE|PADRE|TUTOR|HERMANO|OTRO`), `telefono` E.164, `email` opcional y `prioridad` 1..3, **Then** se crea el contacto vinculado a su `usuarioId`, se valida el teléfono y se audita `CONTACTO_EMERGENCIA_CREADO`.
2. **Given** un contacto existente, **When** el padre envía `PATCH /api/padre/contacto-emergencia/[id]`, **Then** se actualizan solo campos permitidos (`nombre`, `relacion`, `telefono`, `email`, `prioridad`, `activo`) y se audita `CONTACTO_EMERGENCIA_ACTUALIZADO`.
3. **Given** un contacto activo, **When** el padre lo desactiva (`activo: false`), **Then** desaparece de las lecturas de contactos activos pero se conserva el registro.
4. **Given** un padre con múltiples contactos, **When** consulta `GET /api/padre/contacto-emergencia`, **Then** recibe solo sus contactos ordenados por `prioridad ASC`.
5. **Given** un padre autenticado, **When** intenta leer/editar/eliminar un contacto de otro padre, **Then** recibe `404` (A/B) sin tocar nada.
6. **Given** un teléfono con formato inválido, **When** se crea o edita un contacto, **Then** se recibe `400` antes de tocar la BD.

---

### User Story 2 — Sistema fija SLA 12h al subir a ROJO (Priority: P1)

Como operador/comité quiero que cuando un expediente suba a gravedad ROJO el sistema registre un SLA efectivo de 12h y alerte a admin/CEO, para que nadie pierda el compromiso de tiempo crítico.

**Why this priority**: ROJO representa riesgo inminente para un menor; sin un SLA explícito y visible, el caso puede estancarse.

**Independent Test**: publicar el evento `expediente.gravedad.subio_a_rojo` para un expediente; verificar que `slaEfectivoHoras` pasa a 12, se programa notificación URGENTE a admin/CEO y se registra `AuditLog` de nivel `CRITICAL`.

**Acceptance Scenarios**:

1. **Given** un expediente cuyo `scoreGravedadActual` sube a `ROJO`, **When** el Motor de Estados (SPEC-236) publica `expediente.gravedad.subio_a_rojo`, **Then** el handler fija `slaEfectivoHoras = padre.comite.sla_horas_gravedad_roja` (default 12).
2. **Given** el mismo evento, **Then** se programa notificación URGENTE (email + push in-app) a destinatarios admin/CEO vía `programar()` del Motor Notif, usando la plantilla existente `expediente.gravedad.subio_a_rojo` (sembrada por SPEC-236).
3. **Given** el mismo evento, **Then** se registra `AuditLog` con acción `EXPEDIENTE_ESCALADO_A_ROJO`, nivel `CRITICAL`, `entidadId = expediente.id` y metadatos que no incluyen texto de reporte.
4. **Given** un expediente que ya tenía SLA de 12h configurado, **When** vuelve a subir a ROJO, **Then** no se duplica la alerta dentro de la ventana de throttle del Motor Notif.

---

### User Story 3 — Comité activa emergencia y notifica al contacto prioritario (Priority: P1)

Como miembro del comité de validación quiero, ante un caso ROJO, activar la emergencia para que el sistema avise de inmediato al contacto de emergencia de mayor prioridad del padre.

**Why this priority**: el comité puede detectar que un caso requiere contacto telefónico/email inmediato con el acudiente; el sistema debe hacerlo sin que el operador tenga que buscar números a mano.

**Independent Test**: desde `/admin/comite/consolidacion/[id]` de un caso ROJO, pulsar "activar emergencia"; confirmar que el contacto de prioridad 1 recibe notificación urgente y que se publica el evento `expediente.emergencia.activada`.

**Acceptance Scenarios**:

1. **Given** un expediente ROJO visible para un usuario `COMITE_VALIDACION`, **When** envía `POST /api/admin/comite/expediente/[id]/activar-emergencia`, **Then** el expediente queda con `scoreGravedadActual = ROJO` y `estado` en `PENDIENTE_COMITE` o `EN_APROBACION_PADRE` (según reglas del Motor de Estados).
2. **Given** la activación, **Then** el sistema consulta los contactos activos del padre ordenados por `prioridad ASC` y selecciona el de prioridad 1.
3. **Given** un contacto prioritario con teléfono, **Then** se programa notificación urgente SMS (canal `sms`) con la plantilla `expediente.emergencia.activada`.
4. **Given** el mismo contacto con `email`, **Then** también se programa notificación email urgente con la misma plantilla.
5. **Given** que no existe contacto activo de prioridad 1, **When** hay prioridad 2 o 3 activas, **Then** el sistema usa el siguiente activo en orden ascendente (fallback 2 → 3) y registra `CONTACTO_EMERGENCIA_FALLBACK_USADO`.
6. **Given** la activación exitosa, **Then** se publica el evento `expediente.emergencia.activada` para que otros consumidores (histórico, métricas) reaccionen.
7. **Given** la activación, **Then** se registra `AuditLog` con acción `EXPEDIENTE_EMERGENCIA_ACTIVADA`, `activadorId`, `contactoId`, `expedienteId` y timestamp.
8. **Given** un expediente que no está en ROJO, **When** se intenta activar emergencia, **Then** se recibe `409` con mensaje claro.

---

### User Story 4 — Worker vigila SLA 12h y publica vencimiento (Priority: P1)

Como sistema quiero que el worker `pi-expediente-motor` revise cada tick los expedientes ROJO en estados pendientes de atención del comité y, si superan las 12h, publique un evento de SLA vencido.

**Why this priority**: el SLA solo tiene valor si hay un mecanismo automático de detección de incumplimiento; sin eso, el operador/CEO no se entera hasta que alguien revise manualmente.

**Independent Test**: crear un expediente ROJO con `estado = PENDIENTE_COMITE` y `fechaEscaladoRojoEn` hace más de 12h; ejecutar el tick del worker; verificar que se publica `expediente.comite.sla_vencido` y se audita.

**Acceptance Scenarios**:

1. **Given** expedientes ROJO en estados `PENDIENTE_COMITE` o `EN_APROBACION_PADRE` cuya fecha de escalamiento a ROJO supera 12h, **When** el worker `pi-expediente-motor` ejecuta su tick, **Then** publica el evento `expediente.comite.sla_vencido` por cada uno.
2. **Given** un expediente ROJO resuelto o movido a un estado fuera de los vigilados, **Then** el tick lo ignora.
3. **Given** un expediente ROJO en Bogotá (zona horaria explícita `America/Bogota`) con menos de 12h desde el escalamiento, **Then** el tick no publica vencimiento.
4. **Given** el evento `expediente.comite.sla_vencido`, **Then** se programa notificación CRITICAL a admin/CEO y se registra `AuditLog`.
5. **Given** un fallo al publicar un evento, **Then** el worker loguea el error y continúa con los demás expedientes (fail-open por registro, no aborta tick).

---

### User Story 5 — Botón de emergencia en la vista de consolidación (Priority: P2)

Como miembro del comité quiero ver un botón "activar emergencia" solo en casos ROJO, con confirmación modal, para no disparar alertas por accidente.

**Why this priority**: la acción tiene alto impacto (notificación a acudientes, alerta admin); debe ser intencional y visualmente clara.

**Independent Test**: abrir `/admin/comite/consolidacion/[id]` con un caso ROJO → el botón es visible; con otro gravedad no aparece; pulsarlo abre modal de confirmación y reutiliza el componente crítico existente.

**Acceptance Scenarios**:

1. **Given** la vista de consolidación de un expediente ROJO, **Then** se muestra el botón "activar emergencia" con color ruby (`bg-ruby-600` / equivalente del sistema de diseño) y texto neutro.
2. **Given** la misma vista con gravedad distinta a ROJO, **Then** el botón no se renderiza.
3. **Given** que el usuario hace clic en el botón, **Then** se abre un modal de confirmación que explica la consecuencia (notificación al contacto prioritario).
4. **Given** el modal abierto, **When** el usuario confirma, **Then** se ejecuta `POST /api/admin/comite/expediente/[id]/activar-emergencia` y se refresca el estado del expediente.
5. **Given** el modal abierto, **When** el usuario cancela, **Then** no se realiza ninguna mutación.

---

## Edge Cases

- **Padre sin contactos activos**: al activar emergencia, el endpoint devuelve `409` con mensaje claro y no se publica el evento; se audita `EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS`.
- **Contacto prioritario inactivo**: se salta y se usa el siguiente activo; si ninguno está activo, error `409`.
- **Contacto prioritario sin email**: solo se programa SMS; no falla por falta de email.
- **Teléfono mal formado en BD legado**: la validación E.164 en escritura impide crear contactos inválidos; los existentes no se usan hasta que el padre los corrija (se filtran por `activo` y validación en lectura opcional).
- **Activación doble**: si ya existe una activación de emergencia en curso para el mismo expediente (evento ya publicado en ventana de 5 min), el endpoint devuelve `409`.
- **Expediente no ROJO**: `409` antes de tocar contactos.
- **Fallo del Motor Notif**: la programación es best-effort; si `programar()` falla, se registra error, se conserva el `AuditLog` y se devuelve 202 con advertencia (`notificacionProgramada: false`).
- **Worker caído durante tick**: los eventos de vencimiento se pierden hasta el próximo tick; no hay compensación automática (aceptado: el tick es periódico).
- **Cross-user contact leak**: toda lectura de contactos incluye `padreUsuarioId = usuario.id`; cualquier intento de acceso ajeno devuelve `404`.
- **Zona horaria**: todos los cálculos de SLA usan `America/Bogota` para la comparación de 12h; los timestamps se almacenan en UTC (`Timestamptz(6)`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el modelo `ContactoEmergencia` con: `id`, `padreUsuarioId` (FK a `Usuario`), `nombre`, `relacion` (`MADRE|PADRE|TUTOR|HERMANO|OTRO`), `telefono` validado E.164, `email` opcional, `prioridad` entero 1..3, `activo` boolean default `true`, `createdAt`/`updatedAt` como `Timestamptz(6)`, e índice `@@index([padreUsuarioId, prioridad])`.
- **FR-002**: El sistema DEBE crear el repositorio DAL `src/lib/dal/repositories/contacto-emergencia.ts` con acceso CRUD acotado al `padreUsuarioId`.
- **FR-003**: El sistema DEBE extender `src/lib/dal/repositories/expediente.ts` con `marcarEscaladoRojo(expedienteId, datos)` que actualice `scoreGravedadActual`, `estado`, `slaEfectivoHoras` y `fechaEscaladoRojoEn` respetando Q-3.
- **FR-004**: El sistema DEBE implementar un handler para el evento `expediente.gravedad.subio_a_rojo` (publicado por SPEC-236) que: (a) fije SLA efectivo a 12h, (b) programe notificación URGENTE admin/CEO, (c) registre `AuditLog` `CRITICAL`.
- **FR-005**: El sistema DEBE exponer `POST /api/admin/comite/expediente/[id]/activar-emergencia` restringido a rol `COMITE_VALIDACION`, que: (a) verifique ROJO, (b) actualice `scoreGravedadActual=ROJO` y estado compatible, (c) seleccione contacto activo de menor prioridad con fallback 2/3, (d) programe notificación urgente SMS+email, (e) publique evento `expediente.emergencia.activada`, (f) audite la activación.
- **FR-006**: El sistema DEBE exponer CRUD de contactos bajo `/api/padre/contacto-emergencia[/[id]]` restringido a rol `PARENT` y ownership del `padreUsuarioId`.
- **FR-007**: El sistema DEBE validar E.164 en `telefono` en creación/actualización de contactos (Zod + helper reutilizado).
- **FR-008**: El sistema DEBE extender el worker `pi-expediente-motor` de SPEC-236 (D-72) para que, en cada tick, detecte expedientes ROJO en `PENDIENTE_COMITE` o `EN_APROBACION_PADRE` con más de 12h desde `fechaEscaladoRojoEn` y publique `expediente.comite.sla_vencido`.
- **FR-009**: El sistema DEBE añadir al catálogo del Motor Notif (aditivo, sin modificar su código) el evento `expediente.emergencia.activada` con plantilla en español y variables: `contactoNombre`, `relacion`, `telefono`, `expedienteNumero`, `padreNombre`.
- **FR-010**: El sistema DEBE añadir el botón "activar emergencia" en `/admin/comite/consolidacion/[id]` visible solo cuando `scoreGravedadActual === ROJO`, con color ruby, modal de confirmación y reutilización del componente crítico existente.
- **FR-011**: El sistema DEBE sembrar de forma idempotente en `prisma/seed.ts` el parámetro `padre.comite.sla_horas_gravedad_roja = 12` y la entrada de catálogo/plantilla del Motor Notif para `expediente.emergencia.activada`.
- **FR-013**: El sistema DEBE añadir valores al enum `AccionAudit`: `CONTACTO_EMERGENCIA_CREADO`, `CONTACTO_EMERGENCIA_ACTUALIZADO`, `CONTACTO_EMERGENCIA_ELIMINADO`, `CONTACTO_EMERGENCIA_FALLBACK_USADO`, `EXPEDIENTE_ESCALADO_A_ROJO`, `EXPEDIENTE_EMERGENCIA_ACTIVADA`, `EXPEDIENTE_EMERGENCIA_SIN_CONTACTOS`, `EXPEDIENTE_COMITE_SLA_VENCIDO`.

### Key Entities

- **ContactoEmergencia**: contacto de emergencia administrado por el padre. Atributos relevantes: `id`, `padreUsuarioId`, `nombre`, `relacion`, `telefono` (E.164), `email`, `prioridad` (1..3), `activo`, `createdAt`/`updatedAt` (`Timestamptz(6)`).
- **Expediente**: entidad del Motor de Estados (SPEC-236). Atributos relevantes: `id`, `padreUsuarioId`, `identificadorReportado`, `plataformaId`, `estado`, `scoreGravedadActual`, `numEventos`, `fechaApertura`, `fechaCierre`, `fechaEscalado`, `ultimoEventoEn`, `patronesDetectadosJson`, `autoCerradoPorInactividad`, `expedienteRelacionadoAnteriorId`, `createdAt`, `updatedAt`; más los campos aditivos de esta spec `slaEfectivoHoras` y `fechaEscaladoRojoEn`.
- **Usuario**: padre (`RolUsuario.PARENT`) propietario de los contactos; comité (`COMITE_VALIDACION`) que activa emergencia.
- **Motor Notif**: catálogo/plantilla aditiva para el evento `expediente.emergencia.activada`; la notificación admin/CEO al subir a ROJO usa la plantilla existente `expediente.gravedad.subio_a_rojo` de SPEC-236. Función `programar()` expuesta por SPEC-236.
- **AuditLog**: registro inmutable de todas las mutaciones críticas con nivel `CRITICAL` para eventos de emergencia.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un padre puede crear, listar, editar y desactivar contactos; otro padre no puede leerlos (test cross-user).
- **SC-002**: El handler de `expediente.gravedad.subio_a_rojo` fija `slaEfectivoHoras = 12` en menos de 200 ms y programa notificación urgente admin/CEO usando la plantilla existente `expediente.gravedad.subio_a_rojo`.
- **SC-003**: Al activar emergencia, si el contacto de prioridad 1 está inactivo/ausente, el sistema usa prioridad 2 o 3 y registra fallback.
- **SC-004**: El endpoint de activación de emergencia devuelve `409` para expedientes no ROJO y para padres sin contactos activos.
- **SC-005**: El worker publica `expediente.comite.sla_vencido` exactamente para expedientes ROJO con >12h en `PENDIENTE_COMITE` o `EN_APROBACION_PADRE`.
- **SC-006**: La plantilla `expediente.emergencia.activada` se renderiza correctamente con las variables `contactoNombre`, `relacion`, `telefono`, `expedienteNumero`, `padreNombre`.
- **SC-007**: `prisma/seed.ts` es idempotente: ejecutarlo dos veces no duplica catálogo ni parámetros.
- **SC-008**: El gate local completo (`tsc`, `lint`, `test`, `build`, `arch:check`, `dev-restart`) queda verde.

---

## Assumptions

- El Motor de Estados de SPEC-236 ya publica `expediente.gravedad.subio_a_rojo` y expone el worker `pi-expediente-motor` (D-72) para extenderlo.
- El Motor Notif existe como servicio consumible con función `programar()`; esta spec solo añade catálogo y plantillas, sin modificar su implementación.
- La vista `/admin/comite/consolidacion/[id]` es construida por SPEC-237; esta spec solo añade el botón y el modal.
- El padre es el único rol que administra contactos de emergencia; el comité solo los lee para disparar notificaciones.
- El contacto de emergencia no implica llamada telefónica automatizada; el canal SMS usa el proveedor configurado del Motor Notif.
- El cálculo de SLA 12h se realiza en zona horaria `America/Bogota` sobre timestamps UTC almacenados.
- No se implementa historial de emergencias ni escalamiento a autoridades externas en esta spec (reservado para fases posteriores).
- No se implementa UI padre para contactos (SPEC-232).
- No se modifica `src/lib/ai/**` ni la rúbrica de clasificación.

---

## Implementación

Implementada el 2026-08-24 en la rama `work/002-PI-mega-cola-restante` (mega-lote ODIN). Detalle completo de archivos, decisiones, gate y deuda técnica en [`cierre.md`](./cierre.md).

- Migración aditiva `20260824140000_spec_239_contacto_emergencia`: `ContactoEmergencia` + enum `RelacionContactoEmergencia`, campos `Expediente.slaEfectivoHoras`/`fechaEscaladoRojoEn`, 8 valores de `AccionAudit`.
- DAL: `src/lib/dal/repositories/contacto-emergencia.ts` + extensión de `expediente-motor-repository.ts` (`marcarEscaladoRojo`, vigilancia SLA ROJO, ventana anti-doble-activación).
- Handler `src/lib/expediente/handlers/gravedad-subio-a-rojo.ts` integrado en `recalcularGravedad24h` (SLA 12h + evento + `EXPEDIENTE_ESCALADO_A_ROJO`).
- Servicio `src/lib/expediente/activar-emergencia.ts` + endpoint `POST /api/admin/comite/expediente/[id]/activar-emergencia` (fallback de contactos 1→2→3, 409 no-ROJO/sin-contactos/doble, 202 best-effort).
- CRUD padre `/api/padre/contacto-emergencia[/[id]]` con E.164 (Zod), ownership y baja lógica.
- Worker `pi-expediente-motor`: nueva tarea `vigilarSlaRojo` en el tick (sin lock nuevo).
- UI: `BotonActivarEmergencia` (token `rubi` + Modal) en la vista de consolidación, visible solo en ROJO para COMITE_VALIDACION.
- Desviaciones relevantes: canal SMS no existe en Motor Notif → notificación al contacto por EMAIL (deuda documentada); "nivel CRITICAL" va en `AuditLog.metadatos.nivel` (el modelo no tiene columna de nivel).
