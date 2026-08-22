# Feature Specification: SPEC-235 — Guías de acción parametrizables

**Feature Branch**: `work/002-pi-padre-lote-core`

**Created**: 2026-08-22

**Status**: PLANEADO

Impacto en arquitectura: añade modelo `GuiaAccionCategoria` (migración aditiva con índice único parcial manual), repositorio DAL `src/lib/dal/repositories/guia-accion-repository.ts`, 7 endpoints REST bajo `/api/admin/guias-accion/*` y `/api/publico/guia-accion/categoria/[cat]`, dos pantallas admin (`/dashboard/admin/configuracion/guias-accion` y `/dashboard/admin/comite/guias-pendientes`), seed idempotente de 8 guías ACTIVA v1, y tests de integración/unitarios.

**Input**: El flujo padre (SPEC-232) necesita mostrar, tras un reporte o consulta, una guía de acción concreta y validada por el comité según la categoría de riesgo. Hoy el contenido está hardcodeado o ausente. Esta spec parametriza esas guías, las somete a aprobación del comité y expone una versión pública estable.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin crea y edita una guía en borrador (Priority: P1)

Como administrador quiero redactar una guía de acción por categoría de riesgo (título emocional, pasos, callout, botones y pie) mientras está en borrador, para construir el contenido antes de enviarlo a aprobación.

**Why this priority**: sin borrador editable, el comité recibe contenido incompleto; el admin necesita iterar antes de solicitar aprobación.

**Independent Test**: abrir `/dashboard/admin/configuracion/guias-accion`, crear una guía `GROOMING` en estado `BORRADOR`, guardar cambios en los pasos y botones, y verificar que persiste sin ser pública.

**Acceptance Scenarios**:

1. **Given** el formulario de guía, **When** el admin completa `categoria`, `tituloEmocional`, `categoriaBadgeTexto`, `pasosJson` y `botonesAccionJson`, **Then** el sistema crea una fila en `BORRADOR` con `versionSecuencial = 1`.
2. **Given** una guía en `BORRADOR`, **When** el admin edita `pasosJson`, `subtitulo`, `calloutTitulo`, `calloutTexto`, `piePagina` o `botonesAccionJson`, **Then** los cambios se guardan manteniendo el estado `BORRADOR`.
3. **Given** una guía en estado distinto a `BORRADOR`, **When** el admin intenta editarla vía endpoint de borrador, **Then** devuelve `409` con mensaje claro.
4. **Given** el formulario, **When** faltan campos obligatorios (`categoria`, `tituloEmocional`, `categoriaBadgeTexto`, `pasosJson`, `botonesAccionJson`), **Then** devuelve `400` antes de tocar la BD.

---

### User Story 2 — Admin envía una guía al comité (Priority: P1)

Como administrador quiero enviar una guía en borrador al comité de validación, para que revise y apruebe su publicación.

**Why this priority**: la aprobación del comité es el candado de calidad entre borrador y versión pública.

**Independent Test**: desde el panel admin, seleccionar una guía `BORRADOR`, pulsar "Enviar a comité", y verificar que pasa a `PENDIENTE_APROBACION_COMITE` y aparece en `/dashboard/admin/comite/guias-pendientes`.

**Acceptance Scenarios**:

1. **Given** una guía en `BORRADOR`, **When** el admin llama `POST /api/admin/guias-accion/[id]/enviar-comite`, **Then** el estado pasa a `PENDIENTE_APROBACION_COMITE` y se registra en `AuditLog`.
2. **Given** una guía no en `BORRADOR`, **When** el admin intenta enviarla a comité, **Then** devuelve `409`.
3. **Given** una guía `PENDIENTE_APROBACION_COMITE`, **When** el admin intenta editar el contenido, **Then** el endpoint de edición de borrador devuelve `409` (el contenido está congelado para revisión).

---

### User Story 3 — Comité aprueba o rechaza una guía (Priority: P1)

Como miembro del comité de validación quiero aprobar o rechazar una guía pendiente, registrando mi voto junto con el de otros miembros, para garantizar que solo contenido revisado llegue a los padres.

**Why this priority**: las guías son recomendaciones de seguridad a padres; un error puede dañar una investigación o poner en riesgo a un menor.

**Independent Test**: con dos miembros de comité dados de alta, ambos aprueban una guía `PENDIENTE_APROBACION_COMITE`; verificar que pasa a `ACTIVA`, se setea `publicadaEn`, y la guía anterior de la misma categoría pasa a `REEMPLAZADA` con `reemplazadaEn`.

**Acceptance Scenarios**:

1. **Given** una guía `PENDIENTE_APROBACION_COMITE`, **When** un miembro del comité aprueba, **Then** se registra su voto en `aprobadaPorComiteJson` y la guía permanece pendiente hasta alcanzar el mínimo configurado.
2. **Given** una guía con votos suficientes (`padre.comite.miembros_minimos_aprobacion`, default `2`), **When** llega el voto que alcanza el umbral, **Then** la guía pasa a `ACTIVA`, se setea `publicadaEn = now()`, y cualquier guía `ACTIVA` previa de la misma `categoria` pasa a `REEMPLAZADA` con `reemplazadaEn = now()`.
3. **Given** una guía `PENDIENTE_APROBACION_COMITE`, **When** un miembro del comité rechaza con motivo, **Then** la guía vuelve a `BORRADOR`, se limpia `aprobadaPorComiteJson`, y se registra el motivo en `AuditLog`.
4. **Given** un miembro del comité que ya votó, **When** intenta votar nuevamente, **Then** devuelve `409`.
5. **Given** un usuario con rol distinto a `COMITE_VALIDACION`, **When** intenta aprobar/rechazar, **Then** devuelve `403`.

---

### User Story 4 — Padre o visitante consulta la guía pública activa (Priority: P1)

Como padre o visitante quiero consultar la guía de acción correspondiente a una categoría de riesgo desde la interfaz pública, para saber qué hacer de forma clara y validada.

**Why this priority**: este es el objetivo final del flujo padre (SPEC-232): transformar la categoría de una consulta/reporte en acciones concretas.

**Independent Test**: llamar `GET /api/publico/guia-accion/categoria/GROOMING` sin autenticación y verificar que devuelve solo la guía `ACTIVA` con todos sus campos públicos.

**Acceptance Scenarios**:

1. **Given** una categoría con guía `ACTIVA`, **When** un usuario anónimo o `PARENT` consulta el endpoint público, **Then** devuelve `200` con la guía activa.
2. **Given** una categoría sin guía `ACTIVA`, **When** se consulta, **Then** devuelve `404`.
3. **Given** una guía en `BORRADOR`, `PENDIENTE_APROBACION_COMITE` o `REEMPLAZADA`, **When** se consulta por el endpoint público, **Then** devuelve `404` (no es visible).
4. **Given** el endpoint público, **When** se excede el rate-limit configurado, **Then** devuelve `429`.

---

### User Story 5 — Admin previsualiza una guía antes de publicar (Priority: P2)

Como administrador quiero previsualizar una guía en borrador o pendiente exactamente como se verá en la interfaz pública, para validar redacción y botones antes de enviarla a comité.

**Why this priority**: reduce idas y vueltas con el comité; permite corregir errores de formato antes de la aprobación.

**Independent Test**: crear una guía `BORRADOR`, llamar `GET /api/admin/guias-accion/[id]/preview` y verificar que devuelve el mismo shape que el endpoint público.

**Acceptance Scenarios**:

1. **Given** una guía en `BORRADOR` o `PENDIENTE_APROBACION_COMITE`, **When** el admin solicita preview, **Then** devuelve `200` con el payload público de la guía.
2. **Given** una guía `REEMPLAZADA`, **When** el admin solicita preview, **Then** permite preview si el admin tiene acceso de lectura a guías históricas.
3. **Given** una guía inexistente, **When** se solicita preview, **Then** devuelve `404`.

---

### Edge Cases

- **Categoría duplicada en ACTIVA**: el índice único parcial `WHERE estado='ACTIVA'` rechaza la segunda activación; el servicio debe manejar el error de BD y devolver `409`.
- **Aprobación simultánea por dos miembros**: la transacción serializable o el índice parcial evitan que dos guías de la misma categoría queden `ACTIVA`; una espera y la otra reemplaza.
- **Rechazo con votos parciales**: al rechazar se descartan todos los votos previos y se vuelve a `BORRADOR`.
- **Seed reejecutado**: si ya existe una guía `ACTIVA` para la categoría (incluso editada por un admin), el seed no la sobrescribe; solo crea las faltantes marcadas como preliminares.
- **Miembro de comité inactivo**: solo usuarios con `rol=COMITE_VALIDACION` y `estado=activo` pueden votar.
- **Categoría inválida en URL pública**: `GET /api/publico/guia-accion/categoria/XYZ` devuelve `404` sin filtrar por like.
- **Guía ACTIVA editada manualmente en BD**: no se permite; las ediciones solo pueden provenir de una nueva versión `BORRADOR` → aprobación.
- **Contenido de GROOMING sin la regla D-80**: el seed y la UI deben incluir explícitamente la instrucción de NO bloquear el contacto, para preservar evidencia y no alertar al agresor.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el modelo `GuiaAccionCategoria` con los campos del brief §7.5: `categoria`, `versionSecuencial`, `tituloEmocional`, `subtitulo`, `categoriaBadgeTexto`, `pasosJson`, `calloutTitulo`, `calloutTexto`, `botonesAccionJson`, `piePagina`, `estado`, `aprobadaPorComiteJson`, `creadaPorAdminId`, `createdAt`, `publicadaEn`, `reemplazadaEn`.
- **FR-002**: El campo `categoria` DEBE tener unicidad lógica solo dentro del estado `ACTIVA`, implementada mediante un índice único parcial SQL manual `WHERE estado='ACTIVA'`.
- **FR-003**: Todo acceso a datos de `GuiaAccionCategoria` DEBE pasar por el repositorio DAL `src/lib/dal/repositories/guia-accion-repository.ts` (Q-3).
- **FR-004**: El sistema DEBE exponer `POST /api/admin/guias-accion` para crear una guía en `BORRADOR` (solo `ADMIN`).
- **FR-005**: El sistema DEBE exponer `PATCH /api/admin/guias-accion/[id]` para editar campos de una guía solo en estado `BORRADOR` (solo `ADMIN`).
- **FR-006**: El sistema DEBE exponer `POST /api/admin/guias-accion/[id]/enviar-comite` para pasar una guía de `BORRADOR` a `PENDIENTE_APROBACION_COMITE` (solo `ADMIN`).
- **FR-007**: El sistema DEBE exponer `POST /api/admin/comite/guias-accion/[id]/aprobar` para registrar el voto de aprobación de un miembro del comité (solo `COMITE_VALIDACION`).
- **FR-008**: El sistema DEBE exponer `POST /api/admin/comite/guias-accion/[id]/rechazar` para rechazar una guía y devolverla a `BORRADOR` (solo `COMITE_VALIDACION`).
- **FR-009**: El sistema DEBE exponer `GET /api/admin/guias-accion/[id]/preview` para previsualizar cualquier guía existente (solo `ADMIN`).
- **FR-010**: El sistema DEBE exponer `GET /api/publico/guia-accion/categoria/[cat]` para consultar la guía `ACTIVA` de una categoría, aplicando rate-limit.
- **FR-011**: El sistema DEBE mostrar el panel de gestión en `/dashboard/admin/configuracion/guias-accion` (D-72), reutilizando el layout de configuración, con tabs/secciones "Ámbar" (listado/administración) y "Cielo" (preview).
- **FR-012**: El sistema DEBE mostrar la sección de aprobación en `/dashboard/admin/comite/guias-pendientes`, listando guías en `PENDIENTE_APROBACION_COMITE` con acciones de aprobar/rechazar.
- **FR-013**: El sistema DEBE sembrar 8 guías `ACTIVA` v1 de forma idempotente en `prisma/seed.ts`: `GROOMING`, `SEXTORSION`, `DIFUSION_NO_CONSENTIDA`, `EXTORSION`, `DOXING`, `CIBERACOSO`, `SOLICITUD_ENCUENTRO`, `COMPARTIMIENTO_SEXUAL`; todas marcadas como "contenido preliminar · pendiente revisión psicólogo+jurídico".
- **FR-014**: La guía `GROOMING` DEBE incluir explícitamente la regla D-80: NO bloquear el contacto (preserva evidencia y evita alertar al agresor); en cambio, silenciar notificaciones, cambiar contraseñas y bloquear solo por autoridad.
- **FR-015**: El sistema DEBE validar las transiciones de estado permitidas: `BORRADOR` ↔ `PENDIENTE_APROBACION_COMITE`; `PENDIENTE_APROBACION_COMITE` → `ACTIVA` o `BORRADOR`; `ACTIVA` → `REEMPLAZADA` (solo por publicación de nueva versión).
- **FR-016**: El sistema DEBE requerir un mínimo de `padre.comite.miembros_minimos_aprobacion` votos de comité (default `2`) para pasar a `ACTIVA`.
- **FR-017**: El endpoint público DEBE aplicar rate-limit configurable (default 30 req/min por IP), con fail-open y log si falla el limitador.
- **FR-018**: Toda transición de estado de guía DEBE registrarse en `AuditLog` con acción canónica, sin incluir el texto completo de reportes.
- **FR-019**: El sistema DEBE validar con Zod la estructura de `pasosJson` (array con `orden`, `tipo` enum `TRANQUILIDAD|ATENCION|ACCION|URGENCIA`, `titulo`, `descripcion`) y `botonesAccionJson` (array con `tipo`, `texto`, `subtexto`, `url` o `tel`, y flag `primario|urgente|secundario`).
- **FR-020**: El sistema DEBE prohibir el acceso a los endpoints admin a roles `PARENT`, `OPERADOR`, `SCHOOL_ADMIN` y anónimo; el endpoint público debe ser anónimo.

### Key Entities

- **GuiaAccionCategoria**: guía de acción parametrizable por categoría de riesgo. Atributos principales: `categoria`, `versionSecuencial`, `tituloEmocional`, `subtitulo`, `categoriaBadgeTexto`, `pasosJson`, `calloutTitulo`, `calloutTexto`, `botonesAccionJson`, `piePagina`, `estado`, `aprobadaPorComiteJson`, `creadaPorAdminId`, `createdAt`, `publicadaEn`, `reemplazadaEn`.
- **Usuario**: relación inversa `guiasAccionCreadas` (admin creador) y `votosGuiasAccion` (miembros del comité en `aprobadaPorComiteJson`); el repositorio solo lee/escribe `aprobadaPorComiteJson`, no una relación directa.
- **ParametroSistema**: clave `padre.comite.miembros_minimos_aprobacion` (INTEGER, default 2) para el umbral de aprobación.
- **AuditLog**: acciones canónicas `GUIA_ACCION_CREADA`, `GUIA_ACCION_EDITADA`, `GUIA_ACCION_ENVIADA_COMITE`, `GUIA_ACCION_APROBADA`, `GUIA_ACCION_RECHAZADA`, `GUIA_ACCION_PUBLICADA`, `GUIA_ACCION_REEMPLAZADA`.
- **RateLimit**: utilizado por el endpoint público con scope `guias_accion_publica`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Existe exactamente una guía `ACTIVA` por categoría en todo momento; el índice único parcial lo garantiza a nivel de BD.
- **SC-002**: Las transiciones de estado respetan el diagrama de estados; una guía `ACTIVA` nunca vuelve a `BORRADOR` ni se edita directamente.
- **SC-003**: Una guía requiere al menos `padre.comite.miembros_minimos_aprobacion` votos (default 2) para publicarse; con un solo voto permanece pendiente.
- **SC-004**: El endpoint público solo devuelve guías `ACTIVA`; cualquier otro estado responde `404`.
- **SC-005**: El rate-limit del endpoint público bloquea una IP tras exceder el umbral configurable y devuelve `429`.
- **SC-006**: El seed es idempotente: al ejecutarse dos veces no sobrescribe guías personalizadas por un admin; solo crea las 8 guías si faltan.
- **SC-007**: El gate local completo (`tsc`, `lint`, `test`, `build`, `dev-restart`) queda verde.

---

## Assumptions

- Las guías de acción son **globales** (sin `tenantId`): son contenido de configuración de la plataforma, aplicable a todos los usuarios.
- La aprobación por comité usa un umbral configurable `padre.comite.miembros_minimos_aprobacion` (default `2`), sembrado como `ParametroSistema` si no existe.
- No se implementa en esta spec la **vista padre** que consume la guía (SPEC-232), las **notificaciones al comité** cuando hay guías pendientes (SPEC-236), ni el **diff visual entre versiones** (v2).
- No se toca `src/lib/ai/**`; las guías son contenido editorial, no generado por IA.
- Los campos JSON (`pasosJson`, `botonesAccionJson`, `aprobadaPorComiteJson`) se validan estructuralmente con Zod en las rutas API y se almacenan como `Json` de Prisma.
- El contenido preliminar del seed debe mostrar visiblemente la marca "contenido preliminar · pendiente revisión psicólogo+jurídico" en `piePagina` o `calloutTexto`.
- El comité que aprueba guías es el rol `COMITE_VALIDACION` de la plataforma (no el Comité de Convivencia por colegio de SPEC-168).
- ADMIN escribe y envía a comité; COMITE_VALIDACION aprueba/rechaza; PARENT y anónimo solo leen la versión pública.

---

## Implementación

*(Vacío mientras la spec está en estado PLANEADO; se completará al cerrar la feature.)*
