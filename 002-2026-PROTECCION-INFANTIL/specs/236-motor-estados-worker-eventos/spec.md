# Feature Specification: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif

**Feature Branch**: `work/002-pi-padre-lote-core`

**Created**: 2026-08-22

**Status**: PLANEADO

**Dependencia bloqueante**: PR #83 (Motor Notif) debe estar mergeado antes del push final. Esta spec añade 11 eventos y templates al catálogo de Motor Notif; sin la base de PR #83 no puede implementarse ni validarse la integración.

Impacto en arquitectura: añade máquina de estados de `Expediente` en `src/lib/expediente/estados/`, worker propio `scripts/worker-expediente-motor.mjs` con advisory lock, servicio `pi-expediente-motor` en `docker-compose.prod.yml`, endpoint interno `POST /api/interno/expediente/[id]/transicionar`, parámetros `padre.expediente.*` en seed y 11 registros aditivos de eventos/templates de Motor Notif.

**Input**: El módulo padre v2 (SPEC-234) introduce `Expediente`, `EventoExpediente`, `InformeConsolidado`, `ScoreGravedad` y `Aclaracion`. Hace falta un motor que gobierne las transiciones de estado, cierre por inactividad, control de SLA del comité, recálculo de gravedad y retención de datos; además, 11 eventos de negocio deben publicarse en Motor Notif para notificar a actores involucrados.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El sistema gobierna transiciones de estado de un expediente (Priority: P1)

Como sistema quiero que cada cambio de estado de un `Expediente` pase por una whitelist validada, con guards de negocio y auditabilidad, para garantizar que un expediente no avanza o retrocede de forma ilegal.

**Why this priority**: sin una máquina de estados centralizada, el flujo padre-comité-operador se vuelve inconsistente y permite estados inválidos (ej. cerrar sin aprobación o reabrir un expedicio ya cerrado).

**Independent Test**: crear un expediente, agregar eventos hasta superar `consolidacion_min_reportes`, verificar la transición `ACTIVO → CONSOLIDANDO`; luego intentar `ACTIVO → CERRADO` directamente y confirmar que el guard la rechaza.

**Acceptance Scenarios**:

1. **Given** un expediente en estado `ACTIVO` con `numEventos >= padre.expediente.consolidacion_min_reportes`, **When** se invoca `aplicarTransicion` hacia `CONSOLIDANDO`, **Then** la transición se persiste, se registra en `AuditLog` y se publica el evento `expediente.consolidacion.solicitada`.
2. **Given** un expediente `ACTIVO` sin suficientes eventos, **When** se intenta `ACTIVO → CONSOLIDANDO`, **Then** se lanza `AppError` con código `409` y el estado no cambia.
3. **Given** un expediente `CONSOLIDANDO` con un `InformeConsolidado` reciente, **When** se intenta `CONSOLIDANDO → PENDIENTE_COMITE`, **Then** la transición se permite y se publica `expediente.consolidacion.solicitada`.
4. **Given** un expediente `CONSOLIDANDO` sin informe consolidado, **When** se intenta `CONSOLIDANDO → PENDIENTE_COMITE`, **Then** se rechaza con `409`.
5. **Given** un expediente `PENDIENTE_COMITE` cuyo `InformeConsolidado.estadoAprobacion = APROBADO`, **When** se transita a `EN_APROBACION_PADRE`, **Then** se permite y se publica `expediente.comite.aprobo`.
6. **Given** un expediente `EN_APROBACION_PADRE` con una `Aclaracion` en estado `PENDIENTE` (stub=false a partir de SPEC-238), **When** se transita a `EN_ACLARACION`, **Then** se permite y se publica `expediente.aclaracion.solicitada`.
7. **Given** un expediente `EN_ACLARACION` con `Aclaracion.estado = RESPONDIDA`, **When** se transita a `EN_APROBACION_PADRE`, **Then** se permite.
8. **Given** un expediente `EN_APROBACION_PADRE`, **When** se cumple (a) aceptación del padre o (b) cierre forzado tras 1 aclaración, **Then** transita a `CERRADO` y se publica `expediente.cerrado`.
9. **Given** un expediente `CERRADO`, **When** se intenta cualquier transición `CERRADO → *`, **Then** se rechaza con `403` (hard guard §8).
10. **Given** un expediente `CERRADO`, **When** el padre solicita reabrir (v1), **Then** se permite `CERRADO → ESCALADO` y se publica `expediente.escalado`.

---

### User Story 2 — Worker de expediente cierra por inactividad y vigila SLA (Priority: P1)

Como sistema quiero un proceso periódico que cierre expedientes inactivos, recalcule gravedad y alerte cuando el comité excede el SLA, para que no queden casos olvidados.

**Why this priority**: el flujo padre-comité requiere tiempos de respuesta controlados; un expediente ROJO que se queda estancado representa riesgo real.

**Independent Test**: crear un expediente `ACTIVO` cuya última actividad sea anterior a `auto_cierre_meses`, correr el worker y verificar que pasa a `CERRADO` con motivo `AUTO_CIERRE_INACTIVIDAD` y evento `expediente.auto_cerrado_inactividad`.

**Acceptance Scenarios**:

1. **Given** un expediente `ACTIVO` con última actividad más antigua que `padre.expediente.auto_cierre_meses`, **When** el worker ejecuta su tick, **Then** aplica `ACTIVO → CERRADO` con motivo documentado y publica `expediente.auto_cerrado_inactividad`.
2. **Given** un expediente `PENDIENTE_COMITE` sin actividad del comité dentro del SLA (48h normal / 12h ROJO), **When** el worker ejecuta su tick, **Then** publica `expediente.comite.sla_vencido` y registra `AuditLog`.
3. **Given** un expediente con `ScoreGravedad` AMARILLO/VERDE cuya recálificación de datos de las últimas 24h lo eleva a ROJO, **When** el worker detecta el cambio, **Then** publica `expediente.gravedad.subio_a_rojo`.
4. **Given** el worker configurado con `TZ=America/Bogota`, **When** evalúa fechas límite, **Then** usa la zona horaria de Bogotá (no UTC), especialmente en los límites 23:59/00:01.
5. **Given** que ya hay una instancia del worker activa, **When** se intenta levantar otra, **Then** la segunda sale con código 2 por advisory lock.

---

### User Story 3 — Retención de expedientes cerrados sin borrar filas (Priority: P2)

Como sistema quiero anonimizar los textos de expedientes cerrados antiguos reemplazándolos por `[retenido]`, sin eliminar filas, para cumplir con retención y Ley 1581 de 2012.

**Why this priority**: cumplimiento de protección de datos; los textos sensibles no deben permanecer indefinidamente accesibles, pero la trazabilidad de que existió un evento sí se conserva.

**Independent Test**: crear un expediente `CERRADO` con `creadoEn` anterior a `retencion_cerrados_meses`, correr el worker y verificar que `EventoExpediente.texto` e `InformeConsolidado.resumenTextoGenerado`/`pdfUrl` pasan a `[retenido]`.

**Acceptance Scenarios**:

1. **Given** un expediente `CERRADO` con antigüedad mayor a `padre.expediente.retencion_cerrados_meses`, **When** el worker ejecuta su purge, **Then** reemplaza `EventoExpediente.texto` por `[retenido]` e `InformeConsolidado.resumenTextoGenerado` y `pdfUrl` por `[retenido]`.
2. **Given** la purga, **Then** no se eliminan filas; solo se sobrescriben los campos sensibles.
3. **Given** la purga, **Then** se registra `AuditLog` con metadatos (ids afectados, motivo `RETENCION_DATOS`), sin incluir los textos originales.
4. **Given** un expediente `CERRADO` que aún no cumple el plazo de retención, **Then** no se modifica.

---

### User Story 4 — Motor Notif recibe 11 eventos del ciclo de vida del expediente (Priority: P1)

Como sistema quiero que Motor Notif conozca 11 eventos de expediente con templates en español tipo Handlebars, para notificar a padre, comité y operadores según el estado.

**Why this priority**: el flujo padre-comité requiere notificaciones oportunas; centralizar los eventos en Motor Notif permite canales múltiples (email, push, in-app) sin tocar la lógica del motor de estados.

**Independent Test**: invocar cada una de las 11 transiciones/eventos y verificar que Motor Notif genera una notificación con el template correcto y variables resueltas.

**Acceptance Scenarios**:

1. **Given** el catálogo de Motor Notif, **Then** existen los eventos: `expediente.creado`, `expediente.evento.agregado`, `expediente.gravedad.subio_a_rojo`, `expediente.consolidacion.solicitada`, `expediente.comite.aprobo`, `expediente.aclaracion.solicitada`, `expediente.aclaracion.respondida`, `expediente.cerrado`, `expediente.escalado`, `expediente.auto_cerrado_inactividad`, `expediente.comite.sla_vencido`.
2. **Given** cada evento, **Then** existe al menos un template en español con sintaxis Handlebars-like (`{{variable}}`) y asunto/cuerpo apropiado.
3. **Given** un evento publicado, **When** Motor Notif lo procesa, **Then** resuelve variables como `expedienteId`, `estadoDestino`, `actor`, `motivo`, `scoreGravedadActual`, `fechaLimite`.
4. **Given** un evento duplicado por re-ejecución de worker, **Then** el seed de eventos/templates es idempotente y no crea registros repetidos.

---

### User Story 5 — Endpoint interno de transición controlado (Priority: P1)

Como operador/admin o cuenta de servicio quiero un endpoint interno para transicionar un expediente, validando rol y guardias, para poder integrar con UI y workers.

**Why this priority**: la máquina de estados debe ser invocable de forma segura tanto desde la UI del operador como desde el worker de expediente y futuros procesos automatizados.

**Independent Test**: llamar `POST /api/interno/expediente/[id]/transicionar` con un rol ADMIN válido y verificar la transición; luego llamar con rol PARENT y confirmar `403`.

**Acceptance Scenarios**:

1. **Given** una cuenta `ADMIN`, **When** llama al endpoint con `estadoDestino` permitido y guards satisfechos, **Then** la transición se aplica y retorna el `Expediente` actualizado.
2. **Given** una cuenta `PARENT`, **When** llama al endpoint, **Then** retorna `403` (excepto v1: `CERRADO → ESCALADO` según reglas del proxy).
3. **Given** una cuenta de servicio con header `X-Service-Account` y secret válido, **When** llama al endpoint, **Then** se permite si el proxy así lo configura.
4. **Given** una transición rechazada por guard, **Then** el endpoint retorna el código canónico (`409` o `403`) y el estado no cambia.
5. **Given** una transición exitosa, **Then** se registra `AuditLog` y se publica el evento de Motor Notif correspondiente.

---

## Edge Cases

- **Cierre forzado con 0 o >1 aclaraciones**: v1 fuerza cierre solo después de exactamente 1 aclaración respondida; si no hay aclaraciones o hay más de una, el guard debe comportarse según la regla de negocio documentada (rechazar hasta que exista 1 respondida).
- **Inactividad en días de frontera**: un expediente con última actividad a las 23:59 de ayer vs. 00:01 de hoy debe evaluarse con `date-fns-tz` en `America/Bogota`, no por UTC.
- **Worker caído durante tick**: el advisory lock se libera al morir el proceso; la siguiente instancia puede arrancar. No debe quedar transición a medio aplicar: toda transición es una transacción de Prisma.
- **Doble publicación de evento**: si el worker y un operador intentan la misma transición, el guard de whitelist/estado actual impide duplicados; el evento se publica dentro de la TX.
- **Expediente retirado del comité**: si un expediente sale de `PENDIENTE_COMITE` antes de vencer el SLA, el worker no debe publicar `expediente.comite.sla_vencido`.
- **Score ROJO que ya era ROJO**: solo se publica `expediente.gravedad.subio_a_rojo` cuando el score anterior no era ROJO y el nuevo sí lo es.
- **Retención idempotente**: si un campo ya es `[retenido]`, no se vuelve a contabilizar ni publicar evento.
- **PR #83 no mergeado**: se documenta la dependencia y no se hace push final hasta que el catálogo base de Motor Notif exista.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer en `src/lib/expediente/estados/transiciones.ts` un mapa `EstadoActual → EstadoDestino[]` que defina la whitelist de transiciones permitidas, documentando cada guard en una nota breve.
- **FR-002**: El sistema DEBE exponer `src/lib/expediente/estados/aplicar-transicion.ts` con firma `(expedienteId, estadoDestino, motivo?, actor?)` que valide whitelist, ejecute guards, aplique la transición dentro de una transacción Prisma, registre `AuditLog`, publique el evento de Motor Notif y retorne el `Expediente` actualizado.
- **FR-003**: El guard `ACTIVO → CONSOLIDANDO` DEBE exigir `numEventos >= padre.expediente.consolidacion_min_reportes`.
- **FR-004**: El guard `CONSOLIDANDO → PENDIENTE_COMITE` DEBE exigir que exista el `InformeConsolidado` más reciente del expediente.
- **FR-005**: El guard `PENDIENTE_COMITE → EN_APROBACION_PADRE` DEBE exigir `InformeConsolidado.estadoAprobacion = APROBADO`.
- **FR-006**: El guard `EN_APROBACION_PADRE → EN_ACLARACION` DEBE exigir que exista una `Aclaracion` en estado `PENDIENTE` (`stub=false` a partir de SPEC-238).
- **FR-007**: El guard `EN_ACLARACION → EN_APROBACION_PADRE` DEBE exigir `Aclaracion.estado = RESPONDIDA`.
- **FR-008**: El guard `EN_APROBACION_PADRE → CERRADO` DEBE permitir (a) aceptación del padre o (b) cierre forzado tras exactamente 1 aclaración respondida.
- **FR-009**: El sistema DEBE permitir `ACTIVO → CERRADO` automático cuando el worker detecte inactividad mayor a `padre.expediente.auto_cierre_meses`.
- **FR-010**: El sistema DEBE prohibir cualquier transición `CERRADO → *` excepto `CERRADO → ESCALADO` por el padre en v1.
- **FR-011**: El sistema DEBE permitir `* → ESCALADO` solo desde `CERRADO` en v1; la escalación ROJO automática queda para SPEC-239.
- **FR-012**: El sistema DEBE crear el worker `scripts/worker-expediente-motor.mjs` con advisory lock de PostgreSQL propio y `TZ=America/Bogota`.
- **FR-013**: El worker DEBE ejecutar un tick cada `padre.expediente.motor.tick_min` minutos (default 15).
- **FR-014**: El worker DEBE recalcular score de gravedad cada 24h y publicar `expediente.gravedad.subio_a_rojo` cuando un expediente suba a ROJO.
- **FR-015**: El worker DEBE vigilar SLA del comité: 48h para expedientes con score normal y 12h para expedientes ROJO, publicando `expediente.comite.sla_vencido`.
- **FR-016**: El worker DEBE purgar expedientes `CERRADOS` más antiguos que `padre.expediente.retencion_cerrados_meses` reemplazando textos por `[retenido]`, sin eliminar filas y registrando `AuditLog`.
- **FR-017**: El sistema DEBE añadir el servicio `pi-expediente-motor` en `docker-compose.prod.yml` con `TZ=America/Bogota`, siguiendo el patrón de `pi-worker`, `pi-monitor` y `pi-notificaciones`.
- **FR-018**: El sistema DEBE añadir 11 eventos al catálogo de Motor Notif: `expediente.creado`, `expediente.evento.agregado`, `expediente.gravedad.subio_a_rojo`, `expediente.consolidacion.solicitada`, `expediente.comite.aprobo`, `expediente.aclaracion.solicitada`, `expediente.aclaracion.respondida`, `expediente.cerrado`, `expediente.escalado`, `expediente.auto_cerrado_inactividad`, `expediente.comite.sla_vencido`.
- **FR-019**: Para cada evento DEBE existir al menos un template en español con sintaxis Handlebars-like (`{{variable}}`) y variables documentadas.
- **FR-020**: El sistema DEBE exponer `POST /api/interno/expediente/[id]/transicionar` restringido a `ADMIN` o cuenta de servicio autorizada.
- **FR-021**: El endpoint DEBE validar entrada con Zod y delegar a `aplicarTransicion`.
- **FR-022**: El sistema DEBE sembrar los parámetros `padre.expediente.*` y los eventos/templates de Motor Notif de forma idempotente en `prisma/seed.ts`.
- **FR-023**: El sistema DEBE implementar tests unitarios/integración para cada transición válida e inválida, guard `CERRADO → *`, auto-cierre con reloj `date-fns-tz`, datasets AMARILLO/ROJO, SLA vencido en Bogotá, purga sin borrar, idempotencia de seed y advisory lock.

### Key Entities

- **Expediente**: entidad principal del flujo padre. Atributos relevantes: `id`, `padreUsuarioId` (FK a `Usuario.id`), `estado` (`EstadoExpediente`), `scoreGravedadActual`, `numEventos`, `ultimoEventoEn`, `fechaCierre`, `autoCerradoPorInactividad`, `createdAt`, `updatedAt`.
- **EventoExpediente**: evento o reporte agregado a un expediente. Atributos: `id`, `expedienteId`, `ordenSecuencial`, `reporteId`, `fechaEvento`, `texto` (sensible), `categoriaDetectada`, `confianzaClasificacion`, `plataforma`, `adjuntosMetaJson`, `createdAt`.
- **InformeConsolidado**: resultado de consolidación de eventos. Atributos: `id`, `expedienteId`, `estadoAprobacion`, `resumenTextoGenerado`, `pdfUrl`, `creadoEn`, `actualizadoEn`.
- **AclaracionExpediente**: solicitud/respuesta de aclaración del padre. Atributos: `id`, `expedienteId`, `informeConsolidadoId`, `solicitudTexto`, `respuestaTexto`, `respondidaPor`, `estado` (`PENDIENTE`, `RESPONDIDA`, `CERRADA_FORZOSAMENTE`), `solicitadaEn`, `respondidaEn`, `createdAt`.
- **ParametroSistema**: parámetros de configuración `padre.expediente.*`.
- **AuditLog**: registro de cada transición y purga.
- **EventoNotificacion / NotificacionTemplate**: catálogo y templates de Motor Notif (a cargo de PR #83). Esta spec solo añade registros.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `aplicarTransicion` aplica cada transición válida en menos de 200 ms (99p local) y rechaza transiciones inválidas con el código canónico correcto.
- **SC-002**: El worker cierra un expediente inactivo en el primer tick posterior al vencimiento de `auto_cierre_meses`, usando `America/Bogota` y sin falsos positivos en frontera 23:59/00:01.
- **SC-003**: El worker publica `expediente.comite.sla_vencido` exactamente una vez por ventana de vencimiento (48h normal, 12h ROJO) hasta que el estado cambie.
- **SC-004**: El worker detecta subida a ROJO dentro del ciclo de 24h y publica `expediente.gravedad.subio_a_rojo`.
- **SC-005**: La purga de retención reemplaza textos por `[retenido]` en `EventoExpediente` e `InformeConsolidado` sin eliminar filas.
- **SC-006**: Los 11 eventos/templates de Motor Notif se siembran idempotentemente y renderizan correctamente con variables de prueba.
- **SC-007**: El endpoint `POST /api/interno/expediente/[id]/transicionar` retorna `200` para ADMIN/service-account con transición válida y `403`/`409` para inválidas.
- **SC-008**: El gate local completo (`tsc`, `lint`, `test`, `build`, `dev-restart`) queda verde.

---

## Assumptions

- SPEC-234 (InformeConsolidado, Expediente, ScoreGravedad) estará disponible en la misma rama antes de la implementación de código de esta spec; esta documentación asume su modelo y relaciones.
- PR #83 (Motor Notif) provee las tablas `EventoNotificacion` y `NotificacionTemplate` (o equivalentes) y un mecanismo de publicación; esta spec solo añade registros al catálogo y no modifica el motor de notificaciones.
- SPEC-238 implementará el flujo real de `Aclaracion`; en esta spec el guard usa `stub=false` y se asume que la tabla/estados existen.
- SPEC-239 implementará escalación ROJO automática; en esta spec `* → ESCALADO` solo se permite desde `CERRADO` por el padre.
- SPEC-232 (UI padre aceptar/aclarar) y SPEC-237 (bandeja comité consolidación) no se implementan aquí.
- La zona horaria del negocio es `America/Bogota`; todos los cálculos de SLA e inactividad usan `date-fns-tz`.
- El worker de expediente es independiente del worker de reportes y no comparte advisory lock.
- `numEventos` es un contador mantenido por el sistema al agregar `EventoExpediente`; no se calcula con `COUNT(*)` en cada guard.
- El cierre forzado v1 requiere exactamente 1 aclaración respondida; si el producto decide flexibilizarlo en SPEC-238, se actualizará este guard.

---

## Implementación *(por completar al cerrar)*

### Resumen de cambios

*(Se completará tras la implementación con la lista exacta de archivos, migraciones, endpoints y tests.)*

### Decisiones ejecutadas

*(Se completará tras compuertas de revisión.)*

### Gate local

*(Se completará tras validación.)*

### Deuda técnica / notas

*(Se completará al cerrar.)*
