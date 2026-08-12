# Feature Specification: SPEC-169 — Onboarding + cobertura + notificaciones in-app

**Feature Branch**: `work/002-pi-061-g` (propuesta; ajustar al radicar)

**Created**: 2026-08-12

**Status**: PLANEADO

**Input**: Instructivo 002-PI-061-G. Fuentes vinculantes: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §9 (onboarding + cobertura + notificaciones in-app), §6 (Inicio como radar operativo) y §3 (terminología). Patrones: SPEC-134 (tenant-first / DAL E-1), SPEC-149 (avisos por email), SPEC-162 (migración aditiva).

**Aclaración terminológica (Colombia)**:
- **Sujeto** = estudiante · profesor · acudiente.
- **Cobertura** = porcentaje de sujetos activos que tienen al menos un identificador activo registrado.
- **Onboarding** = flujo "Activa tu protección" que guía al rector a completar los pasos previos para que el sistema pueda generar alertas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector ve el onboarding "Activa tu protección" (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero que el sistema me diga, al entrar, qué debo hacer para empezar a recibir alertas, sin tener que adivinar.

**Why this priority**: sin identificadores registrados el sistema "queda mudo"; el onboarding reduce el tiempo hasta el primer valor.

**Independent Test**: un rector nuevo ve el onboarding; un rector que lo completó u omitió no lo ve; otro rol no lo ve.

**Acceptance Scenarios**:

1. **Given** un colegio recién creado, **When** el rector accede a `/dashboard/colegio`, **Then** se muestra el onboarding "Activa tu protección" con los pasos: cursos, estudiantes, profesores, acudientes e identificadores.
2. **Given** un rector autenticado, **When** llama `GET /api/colegio/onboarding`, **Then** recibe el estado (`activo` | `omitido` | `completado`), el `pasoActual` y el estado calculado de cada paso (`pendiente` | `completado`).
3. **Given** un rector, **When** envía `PATCH /api/colegio/onboarding` con `estado: "omitido"`, **Then** el onboarding se oculta, se audita `COLEGIO_ONBOARDING_OMITIDO` y no vuelve a aparecer en el login.
4. **Given** un rector, **When** envía `PATCH /api/colegio/onboarding` con `estado: "activo"` desde configuración, **Then** el onboarding se reactiva y se audita `COLEGIO_ONBOARDING_REACTIVADO`.
5. **Given** un rector de otro colegio, **When** intenta leer/modificar el onboarding ajeno, **Then** recibe `404` (A/B).

---

### User Story 2 — El onboarding avanza automáticamente según los datos del colegio (Priority: P1)

Como rector quiero que el onboarding reconozca lo que ya cargué, para no repetir pasos ni marcar checkboxes manualmente.

**Why this priority**: evita fricción innecesaria y mantiene el estado sincronizado con la realidad del colegio.

**Independent Test**: al crear cursos, estudiantes, profesores, acudientes e identificadores, el onboarding refleja cada paso como completado.

**Acceptance Scenarios**:

1. **Given** 0 cursos activos, **When** se consulta el onboarding, **Then** el paso "Cursos" está `pendiente` y ofrece CTA a crear curso.
2. **Given** al menos 1 curso activo, **When** se consulta el onboarding, **Then** el paso "Cursos" está `completado` y el paso "Estudiantes" se activa.
3. **Given** al menos 1 estudiante activo, **When** se consulta, **Then** el paso "Estudiantes" está `completado`.
4. **Given** al menos 1 profesor activo, **When** se consulta, **Then** el paso "Profesores" está `completado`.
5. **Given** al menos 1 acudiente activo, **When** se consulta, **Then** el paso "Acudientes" está `completado`.
6. **Given** cobertura global > 0 (al menos un sujeto con identificador activo), **When** se consulta, **Then** el paso "Identificadores" está `completado` y el onboarding pasa a `completado`.

---

### User Story 3 — Anillo de cobertura empuja a completar identificadores (Priority: P1)

Como rector quiero ver, en un vistazo de 3 segundos, qué porcentaje de estudiantes, profesores y acudientes ya tienen identificadores, y cómo completar el resto.

**Why this priority**: cierra el hueco crítico de cobertura identificado en el brief §9; la acción directa aumenta la tasa de completitud.

**Independent Test**: los anillos reflejan el % real de cada sujeto y cambian al agregar o inactivar identificadores.

**Acceptance Scenarios**:

1. **Given** la página de inicio del colegio, **When** carga, **Then** se llama `GET /api/colegio/cobertura` y se muestran tres anillos con el % de estudiantes, profesores y acudientes con identificador activo.
2. **Given** cobertura del 100 % en una categoría, **When** se renderiza el anillo, **Then** se muestra en verde/pino con check y sin CTA.
3. **Given** cobertura < 100 %, **When** se renderiza, **Then** el anillo usa ámbar/rubí según el % y muestra un botón que lleva a la acción de completar (carga masiva, ficha de curso, etc.).
4. **Given** 0 registros de un tipo (por ejemplo, aún no hay profesores), **When** se renderiza, **Then** se muestra 0 % y CTA para dar de alta ese tipo de sujeto, sin división por cero.
5. **Given** un rector de otro colegio, **When** llama `/api/colegio/cobertura`, **Then** recibe `404`.

---

### User Story 4 — Centro de notificaciones in-app (Priority: P1)

Como rector quiero recibir avisos dentro de la plataforma cuando hay alertas nuevas, cambios de estado o eventos relevantes, además de los emails de SPEC-149.

**Why this priority**: el email puede perderse; una bandeja in-app garantiza que el rector vea lo urgente al entrar.

**Independent Test**: una alerta nueva genera una notificación in-app; el rector puede leerla, marcar todas como leídas y archivarla.

**Acceptance Scenarios**:

1. **Given** una nueva `AlertaColegio`, **When** se crea, **Then** el sistema inserta una `NotificacionInApp` de tipo `ALERTA_NUEVA` para el rector del colegio, sin incluir el contenido del reporte ni el denunciante.
2. **Given** una alerta que cambia de `nueva` a `gestionada` o `escalada`, **When** se actualiza, **Then** se inserta una notificación del tipo correspondiente.
3. **Given** un rector autenticado, **When** llama `GET /api/colegio/notificaciones`, **Then** recibe las notificaciones no archivadas ordenadas por `creadoEn` descendente, paginadas.
4. **Given** una notificación no leída, **When** el rector envía `PATCH /api/colegio/notificaciones/[id]/leida`, **Then** `leidaEn` se registra.
5. **Given** varias notificaciones no leídas, **When** envía `PATCH /api/colegio/notificaciones/marcar-leidas`, **Then** todas pasan a leídas.
6. **Given** una notificación leída, **When** envía `DELETE /api/colegio/notificaciones/[id]`, **Then** se marca con `archivadaEn` (soft delete).
7. **Given** el icono de campana, **When** hay notificaciones no leídas, **Then** se muestra un badge con el conteo obtenido de `GET /api/colegio/notificaciones/resumen`.
8. **Given** un evento de sistema (por ejemplo, vencimiento próximo del servicio), **When** se dispara, **Then** se crea una notificación `SISTEMA`.

---

## Edge Cases

- **Colegio sin rector**: el onboarding y las notificaciones no se muestran hasta que exista un usuario `SCHOOL_ADMIN` activo vinculado al colegio.
- **Cobertura con denominador 0**: si no hay estudiantes/profesores/acudientes, el % es 0 y el mensaje guía al alta.
- **Identificadores inactivos**: no cuentan para la cobertura; solo identificadores con `estado = "activo"`.
- **Notificación duplicada**: un mismo evento (misma alerta, mismo tipo) no genera más de una notificación in-app por día; se usa `(colegioId, usuarioId, tipo, entidadId, dia)` para idempotencia si aplica.
- **Notificaciones masivas**: si llegan muchas alertas, el badge y el listado se mantienen funcionales gracias a paginación e índices.
- **Cross-tenant**: toda lectura/escritura de onboarding, cobertura y notificaciones se acota por `colegioId`; acceso ajeno devuelve `404`.
- **Reduced motion**: las animaciones de los anillos respetan `prefers-reduced-motion`.
- **Email caído**: la notificación in-app se crea de forma asíncrona y no depende del éxito del envío de email de SPEC-149.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar el onboarding "Activa tu protección" al `SCHOOL_ADMIN` mientras el colegio tenga el onboarding en estado `activo`.
- **FR-002**: El sistema DEBE calcular automáticamente el progreso del onboarding a partir de cursos, estudiantes, profesores, acudientes e identificadores activos del colegio.
- **FR-003**: El sistema DEBE permitir al `SCHOOL_ADMIN` omitir el onboarding (`omitido`) y reactivarlo (`activo`) desde configuración.
- **FR-004**: El sistema DEBE exponer, vía `GET /api/colegio/cobertura`, el porcentaje de estudiantes, profesores y acudientes con al menos un identificador activo.
- **FR-005**: El sistema DEBE mostrar anillos de cobertura en la página de inicio del colegio con color según el % y CTA para completar.
- **FR-006**: El sistema DEBE crear notificaciones in-app cuando se generan alertas (`ALERTA_NUEVA`), cambian de estado (`ALERTA_GESTIONADA`, `ALERTA_ESCALADA`) o suceden eventos de sistema (`SISTEMA`).
- **FR-007**: El sistema DEBE exponer endpoints REST para listar, marcar como leída, marcar todas como leídas y archivar notificaciones in-app.
- **FR-008**: El sistema DEBE mostrar un badge de notificaciones no leídas en el header del dashboard del colegio.
- **FR-009**: El sistema DEBE garantizar que las notificaciones in-app NUNCA incluyan el texto del reporte ni datos del denunciante.
- **FR-010**: El sistema DEBE mantener todo colegio-scoped (`colegioId`) y NO modificar `Curso` ni `Estudiante.cursoId`.
- **FR-011**: El sistema DEBE auditar las mutaciones de onboarding y notificaciones in-app.
- **FR-012**: El sistema DEBE generar notificaciones in-app de forma independiente al pipeline de email de SPEC-149.

### Key Entities

- **OnboardingColegio**: fila única por colegio con `estado`, `pasoActual` y `completadoEn`; el progreso de los pasos se calcula dinámicamente.
- **NotificacionInApp**: mensaje dirigido al usuario del colegio; estados implícitos por `leidaEn` / `archivadaEn`.

---

## Success Criteria *(mandatory)*

- **SC-001**: El onboarding se muestra solo cuando aplica y desaparece tras `completado` u `omitido`.
- **SC-002**: El cálculo de cobertura responde en < 500 ms para un colegio con 10 000 estudiantes.
- **SC-003**: Una notificación in-app se crea en < 1 s tras la creación de una alerta.
- **SC-004**: El 100 % de las operaciones de onboarding, cobertura y notificaciones respetan el aislamiento por `colegioId`.
- **SC-005**: El badge de notificaciones refleja siempre el conteo real de no leídas.
- **SC-006**: La migración de BD es aditiva: crea `OnboardingColegio` y `NotificacionInApp`; no modifica `Curso`, `Estudiante.cursoId` ni tablas del motor.

---

## Impacto en arquitectura

- **Modelo de datos**: se añaden `OnboardingColegio` y `NotificacionInApp` con migración aditiva; se amplía el enum `AccionAudit` con los eventos del onboarding y las notificaciones.
- **DAL**: nuevos repositorios `OnboardingColegioRepository`, `CoberturaRepository` y `NotificacionInAppRepository` (patrón tenant-first SPEC-134).
- **API**: endpoints bajo `/api/colegio/onboarding`, `/api/colegio/cobertura` y `/api/colegio/notificaciones`, con validación Zod y rate limiting.
- **UI**: componente `OnboardingColegio` (modal/wizard), `AnillosCobertura` en `/dashboard/colegio` y `CentroNotificaciones` en el header del colegio.
- **Integración**: los servicios que crean/actualizan `AlertaColegio` insertan filas en `NotificacionInApp` de forma transaccional o asíncrona.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar tablas, rutas y componentes nuevos.

---

## Assumptions

- Las fases A (acudiente completo) y B (identificadores de profesor) entregan las tablas de identificadores de acudiente y profesor. Esta fase las lee solo para calcular cobertura.
- El destinatario del onboarding, la cobertura y las notificaciones in-app es el usuario `SCHOOL_ADMIN` del colegio (`Usuario.colegioId`).
- Los wizards de alta de cursos, estudiantes, profesores y acudientes ya existen; el onboarding solo redirige a ellos.
- El home del colegio ya existe (SPEC-129/SPEC-143) y dispone de un punto de montaje para los anillos.
- Las alertas del colegio ya se generan en un servicio centralizado que puede extenderse para crear notificaciones in-app.
- No se requiere envío push al navegador; el centro de notificaciones es in-app únicamente.
