# Feature Specification: SPEC-168 — Comité de Convivencia por colegio

**Feature Branch**: `work/002-pi-068`

**Created**: 2026-08-12

**Status**: PLANEADO

**Input**: BRIEF-MODULO-COLEGIO §4.3 y §5 (ciclo del caso + Comité). Fuentes vinculantes: BRIEF-MODULO-COLEGIO §2 (invariante de privacidad), §3 (terminología), §4.3 (Comité de Convivencia), §5 (identificar → gestionar → escalar → revisar → cerrar). Patrones: SPEC-024 (Comité de Validación: cuenta única + integrantes documentados), SPEC-053 (servicios de operadores/comité), SPEC-128 (grants del comité), SPEC-134 (tenant-first / DAL E-1), SPEC-159 (seguimiento del caso y bitácora).

**Aclaración terminológica (Colombia)**:
- **Comité de Convivencia**: cuerpo del colegio que revisa casos escalados. Es una **cuenta compartida de login por colegio**.
- **Integrante del comité**: persona documentada (nombre, documento, email, cargo, estado) **sin login individual**.
- **Rector**: rol técnico `SCHOOL_ADMIN`; administra la cuenta y los integrantes del comité.
- **Caso**: la alerta del colegio (`AlertaColegio`) y su seguimiento (`SeguimientoCaso`/`NotaSeguimiento`).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector crea y administra la cuenta compartida del Comité de Convivencia (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero crear una única cuenta de login para el Comité de Convivencia de mi colegio y regenerar su contraseña, para que el comité pueda entrar a la plataforma sin que cada integrante tenga credenciales.

**Why this priority**: es el prerrequisito técnico y legal (Decreto 0769/2026) para que el comité opere; sin cuenta no hay revisión de casos.

**Independent Test**: un rector puede crear la cuenta del comité de su colegio, verla, regenerar la contraseña; otro rector no ve ni toca la cuenta ajena; no se pueden crear dos cuentas por colegio.

**Acceptance Scenarios**:

1. **Given** un rector autenticado sin cuenta de comité, **When** envía `POST /api/colegio/comite/cuenta` con `email`, **Then** se crea un usuario con rol `COMITE_CONVIVENCIA`, vinculado al `colegioId` del rector, con contraseña temporal, y se audita `COLEGIO_COMITE_CREADO`.
2. **Given** un rector, **When** consulta `GET /api/colegio/comite/cuenta`, **Then** recibe el estado de la cuenta de su colegio (email, estado, último acceso) o indica que aún no existe.
3. **Given** una cuenta existente, **When** el rector envía `POST /api/colegio/comite/cuenta/regenerar-password`, **Then** se genera una nueva contraseña temporal, se hashea, se invalida la anterior y se audita `COLEGIO_COMITE_PASSWORD_REGENERADA`.
4. **Given** un rector, **When** intenta crear una segunda cuenta para su colegio, **Then** recibe `409` con mensaje claro.
5. **Given** un rector de otro colegio, **When** intenta consultar/regenerar la cuenta ajena, **Then** recibe `404` sin tocar nada (A/B).
6. **Given** un email ya usado por otro usuario, **When** se intenta crear la cuenta del comité, **Then** recibe `409` por unicidad de email.

---

### User Story 2 — Rector administra los integrantes documentados del comité (Priority: P1)

Como rector quiero documentar quiénes conforman el Comité de Convivencia (nombre, documento, email, cargo, estado), sin que cada uno tenga login, para cumplir con el registro legal y facilitar la auditoría.

**Why this priority**: el Decreto 0769/2026 exige que el colegio tenga un Comité Escolar de Convivencia documentado; además la plataforma debe saber quién integra el cuerpo sin exponer credenciales.

**Independent Test**: un rector puede crear, editar, inactivar y reactivar integrantes; el número de identificación se cifra en reposo; otro rector no ve el padrón ajeno.

**Acceptance Scenarios**:

1. **Given** un rector, **When** envía `POST /api/colegio/comite/integrantes` con `nombres`, `apellidos`, `tipoIdentificacion`, `numeroIdentificacion`, `email` y `cargo`, **Then** se crea el integrante vinculado a la cuenta del comité de su colegio y se audita `COLEGIO_COMITE_INTEGRANTE_CREADO`.
2. **Given** un integrante existente, **When** el rector envía `PATCH /api/colegio/comite/integrantes/[id]` para cambiar el cargo o el email, **Then** se actualiza y se audita `COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO`.
3. **Given** un integrante activo, **When** el rector envía `PATCH /api/colegio/comite/integrantes/[id]/estado` con `INACTIVO`, **Then** el integrante queda inactivo, se registra `fechaFin` y se audita `COLEGIO_COMITE_INTEGRANTE_INACTIVADO`.
4. **Given** un integrante inactivo, **When** el rector lo reactiva, **Then** vuelve a `ACTIVO`, se limpia `fechaFin` y se audita `COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO`.
5. **Given** un rector de otro colegio, **When** intenta leer/editar/inactivar un integrante ajeno, **Then** recibe `404` (A/B).
6. **Given** un intento de crear dos integrantes con el mismo número de identificación en el mismo comité, **Then** se recibe `409`.
7. **Given** el campo `numeroIdentificacion`, **When** se persiste, **Then** viaja cifrado con AES-256-GCM y solo se descifra para lecturas autorizadas del rector de ese colegio.

---

### User Story 3 — Rector escala un caso al Comité de Convivencia (Priority: P1)

Como rector quiero enviar una alerta al Comité de Convivencia para que revise el caso y tome una decisión documentada.

**Why this priority**: cierra el ciclo "identificar → gestionar → escalar → revisar → cerrar" del brief §5; sin escalamiento el comité no tiene casos que resolver.

**Independent Test**: un rector escala una alerta de su colegio; se crea una `SolicitudComite` colegio-scoped; el comité la ve; una alerta ya escalada no se escala dos veces.

**Acceptance Scenarios**:

1. **Given** una alerta de su colegio en estado `nueva` o `vista`, **When** el rector envía `POST /api/colegio/alertas/[id]/escalar` con `motivo`, **Then** se crea una `SolicitudComite` en estado `PENDIENTE`, vinculada al `colegioId` y a la `alertaColegioId`, y se audita `COLEGIO_CASO_ESCALADO_A_COMITE`.
2. **Given** una alerta ya escalada, **When** el rector intenta escalarla de nuevo, **Then** recibe `409`.
3. **Given** una alerta de otro colegio, **When** el rector intenta escalarla, **Then** recibe `404`.
4. **Given** un rector sin cuenta de comité creada, **When** intenta escalar, **Then** recibe `400` con mensaje indicando que debe crear primero la cuenta del comité.
5. **Given** una alerta escalada, **When** el comité inicia sesión, **Then** la solicitud aparece en su bandeja.

---

### User Story 4 — Comité de Convivencia inicia sesión y ve su bandeja de casos (Priority: P1)

Como miembro del Comité de Convivencia (usando la cuenta compartida del colegio) quiero ver los casos escalados por el rector, para revisarlos y decidir.

**Why this priority**: es la función principal del rol `COMITE_CONVIVENCIA`; la bandeja debe estar acotada estrictamente al colegio.

**Independent Test**: un usuario `COMITE_CONVIVENCIA` inicia sesión, ve solo las solicitudes de su colegio y no puede ver solicitudes del comité de validación de la plataforma ni de otros colegios.

**Acceptance Scenarios**:

1. **Given** una cuenta `COMITE_CONVIVENCIA` activa, **When** inicia sesión con email y contraseña temporal, **Then** recibe JWT y cookie con `rol: COMITE_CONVIVENCIA`, y el proxy lo redirige a `/dashboard/colegio/comite/casos`.
2. **Given** un comité autenticado, **When** consulta `GET /api/colegio/comite/solicitudes`, **Then** recibe solo las solicitudes `PENDIENTE`/`RESUELTA` de su colegio, paginadas.
3. **Given** un comité autenticado, **When** consulta la bandeja, **Then** no ve el contenido del reporte ni quién lo reportó (invariante de privacidad).
4. **Given** un comité de otro colegio, **When** intenta ver/alterar una solicitud ajena por id, **Then** recibe `404`.
5. **Given** una cuenta inactiva, **When** intenta iniciar sesión, **Then** recibe `401`/`403`.

---

### User Story 5 — Comité de Convivencia ve el detalle de un caso (Priority: P2)

Como comité quiero abrir un caso escalado y ver un resumen ejecutivo con historial y bitácora, para tener el contexto necesario sin violar la privacidad.

**Why this priority**: cierra la usabilidad de la bandeja; el comité necesita contexto para decidir, pero nunca el texto del reporte ni el denunciante.

**Independent Test**: el comité abre una solicitud y ve el resumen de la alerta, la línea de tiempo, las notas de seguimiento y la información del escalamiento; no ve contenido/denunciante.

**Acceptance Scenarios**:

1. **Given** una solicitud pendiente de su colegio, **When** el comité consulta `GET /api/colegio/comite/solicitudes/[id]`, **Then** recibe el resumen: categoría, gravedad, sujeto (estudiante/profesor/acudiente), curso, plataforma, fecha, estado de la alerta, timeline, notas de seguimiento y motivo de escalamiento.
2. **Given** el detalle del caso, **When** se renderiza, **Then** no incluye `texto` del reporte, `identificador` en claro, `usuarioId` denunciante ni huellas.
3. **Given** una solicitud resuelta, **When** el comité la abre, **Then** ve la resolución documentada y la fecha de cierre.
4. **Given** una solicitud de otro colegio, **When** se consulta por id, **Then** recibe `404`.

---

### User Story 6 — Comité de Convivencia cierra un caso con decisión (Priority: P1)

Como comité quiero documentar la decisión tomada y cerrar el caso, para dejar constancia oficial de la actuación del Comité de Convivencia.

**Why this priority**: es el cierre del ciclo del caso; sin decisión documentada no hay cumplimiento demostrable ante la Secretaría de Educación / ICBF.

**Independent Test**: el comité resuelve una solicitud; la solicitud pasa a `RESUELTA`, la alerta se marca como gestionada, se registra la decisión y se audita.

**Acceptance Scenarios**:

1. **Given** una solicitud `PENDIENTE` de su colegio, **When** el comité envía `POST /api/colegio/comite/solicitudes/[id]/resolver` con `resolucion`, **Then** la solicitud pasa a `RESUELTA`, se guarda `resolucion` y `resueltoEn`, la alerta pasa a `gestionada`, y se audita `COLEGIO_CASO_RESUELTO_POR_COMITE`.
2. **Given** una solicitud ya resuelta, **When** se intenta resolver de nuevo, **Then** recibe `409`.
3. **Given** una solicitud de otro colegio, **When** se intenta resolver, **Then** recibe `404`.
4. **Given** una solicitud resuelta, **When** el rector abre el caso, **Then** ve la decisión del comité en el historial y la alerta marcada como gestionada.
5. **Given** el cierre de un caso, **When** se audita, **Then** no se incluye el texto del reporte ni PII en `AuditLog.valorNuevo`.

---

### Edge Cases

- **Cuenta duplicada por colegio**: `Usuario.comiteColegioId @unique` garantiza una sola cuenta `COMITE_CONVIVENCIA` por colegio.
- **Email duplicado**: la unicidad global de `Usuario.email` impide reusar un email de otro rol/usuario.
- **Integrante duplicado**: unique `(comiteId, numeroIdentificacion)` o validación de negocio evita el mismo documento dos veces en el mismo comité.
- **Escalamiento doble**: `SolicitudComite.alertaColegioId @unique` (o validación en servicio) evita escalar la misma alerta dos veces.
- **Alerta ajena**: toda lectura/escritura de alertas incluye `colegioId`; acceso a una alerta de otro colegio devuelve `404`.
- **Solicitud ajena**: el servicio filtra por `colegioId` del comité autenticado.
- **Comité inactivo**: `Usuario.estado = inactivo` bloquea el login.
- **Colegio sin servicio vigente**: el layout y las APIs de colegio bloquean el acceso con el mismo mensaje de vigencia usado para `SCHOOL_ADMIN`.
- **Sin cuenta de comité**: el endpoint de escalamiento rechaza con `400` indicando que el rector debe crear la cuenta primero.
- **Preservación de privacidad**: ni el rector ni el comité ven el texto original del reporte ni quién lo reportó; el detalle del caso reusa `obtenerDetalleCaso` con el mismo blindaje de SPEC-159.
- **Rollback seguro**: la creación de cuenta, la regeneración de contraseña, el alta de integrante, el escalamiento y la resolución usan transacciones (`withUnitOfWork`) o secuencias atómicas.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE añadir el rol `COMITE_CONVIVENCIA` al enum `RolUsuario`.
- **FR-002**: El sistema DEBE permitir que un colegio tenga exactamente una cuenta compartida de login con rol `COMITE_CONVIVENCIA`, vinculada a ese colegio.
- **FR-003**: El sistema DEBE permitir al `SCHOOL_ADMIN` crear la cuenta del comité (`POST /api/colegio/comite/cuenta`).
- **FR-004**: El sistema DEBE permitir al `SCHOOL_ADMIN` consultar la cuenta del comité (`GET /api/colegio/comite/cuenta`).
- **FR-005**: El sistema DEBE permitir al `SCHOOL_ADMIN` regenerar la contraseña de la cuenta del comité (`POST /api/colegio/comite/cuenta/regenerar-password`).
- **FR-006**: El sistema DEBE permitir al `SCHOOL_ADMIN` listar, crear, editar e inactivar/reactivar los integrantes del comité de su colegio.
- **FR-007**: El sistema DEBE almacenar los integrantes en la tabla `IntegranteComite` reutilizada, añadiendo el campo `cargo`.
- **FR-008**: El sistema DEBE garantizar que los integrantes **no** tienen login individual.
- **FR-009**: El sistema DEBE cifrar el número de identificación de los integrantes en reposo (AES-256-GCM) y descifrarlo solo para lecturas autorizadas.
- **FR-010**: El sistema DEBE permitir al `SCHOOL_ADMIN` escalar una alerta de su colegio al comité (`POST /api/colegio/alertas/[id]/escalar`).
- **FR-011**: El sistema DEBE crear una `SolicitudComite` colegio-scoped al escalar, reutilizando la tabla existente con los campos adicionales `colegioId` y `alertaColegioId`.
- **FR-012**: El sistema DEBE permitir al `COMITE_CONVIVENCIA` listar solo las solicitudes de su colegio (`GET /api/colegio/comite/solicitudes`).
- **FR-013**: El sistema DEBE permitir al `COMITE_CONVIVENCIA` ver el detalle de una solicitud de su colegio (`GET /api/colegio/comite/solicitudes/[id]`).
- **FR-014**: El sistema DEBE mostrar en el detalle del caso: resumen ejecutivo, historial/timeline, bitácora de seguimiento y motivo de escalamiento.
- **FR-015**: El sistema DEBE permitir al `COMITE_CONVIVENCIA` agregar notas a la bitácora del caso (reusando `NotaSeguimiento`).
- **FR-016**: El sistema DEBE permitir al `COMITE_CONVIVENCIA` cerrar una solicitud con una resolución documentada (`POST /api/colegio/comite/solicitudes/[id]/resolver`).
- **FR-017**: El sistema DEBE actualizar el estado de la alerta asociada a `gestionada` al resolver la solicitud.
- **FR-018**: El sistema DEBE auditar todas las mutaciones con acciones específicas: `COLEGIO_COMITE_CREADO`, `COLEGIO_COMITE_PASSWORD_REGENERADA`, `COLEGIO_COMITE_INTEGRANTE_CREADO`, `COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO`, `COLEGIO_COMITE_INTEGRANTE_INACTIVADO`, `COLEGIO_CASO_ESCALADO_A_COMITE`, `COLEGIO_CASO_RESUELTO_POR_COMITE`.
- **FR-019**: El sistema DEBE añadir los módulos de permiso `colegios_comite` (gestión del comité por el rector) y `colegios_comite_bandeja` (bandeja del comité) al catálogo.
- **FR-020**: El sistema DEBE mantener la migración aditiva: **NO** modificar `Curso`, **NO** modificar `Estudiante.cursoId`, **NO** tocar `src/lib/ai/**`.

### Key Entities

- **Usuario (comité)**: cuenta compartida. Atributos relevantes: `id`, `email` (único global), `passwordHash`, `rol = COMITE_CONVIVENCIA`, `estado`, `comiteColegioId` (FK única a `Colegio.id`), `debeCambiarPassword`.
- **IntegranteComite**: padrón documentado del comité. Atributos: `id`, `comiteId` (Usuario.id), `nombres`, `apellidos`, `tipoIdentificacion`, `numeroIdentificacion` (cifrado), `email`, `cargo`, `fechaInicio`, `fechaFin`, `estado`, `creadoPorId`, `modificadoPorId`.
- **SolicitudComite**: escalamiento colegio-scoped. Atributos: `id`, `reporteId`, `numero`, `estado`, `comiteId`, `operadorId`, `colegioId`, `alertaColegioId`, `creadoPorId`, `motivo`, `resolucion`, `creadoEn`, `resueltoEn`.
- **AlertaColegio**: origen del caso. Mantiene su `colegioId` y su estado (`nueva` | `vista` | `gestionada`).
- **SeguimientoCaso / NotaSeguimiento**: bitácora inmutable del caso (reuso SPEC-159).

---

## Success Criteria *(mandatory)*

- **SC-001**: Un colegio tiene exactamente una cuenta `COMITE_CONVIVENCIA` y ningún otro rol puede ocupar `comiteColegioId`.
- **SC-002**: El 100% de las operaciones de gestión del comité (cuenta e integrantes) están acotadas al `colegioId` del rector.
- **SC-003**: El número de identificación de los integrantes se almacena cifrado y solo se descifra en lecturas autorizadas del rector de ese colegio.
- **SC-004**: El rector puede escalar una alerta y el comité la ve en su bandeja en menos de 500 ms para colegios con < 1000 alertas.
- **SC-005**: El comité solo ve solicitudes de su colegio; intentos de acceso a solicitudes ajenas devuelven `404`.
- **SC-006**: Ni el rector ni el comité ven el texto original del reporte ni quién lo reportó en ninguna vista o API del comité.
- **SC-007**: Al resolver un caso, la solicitud pasa a `RESUELTA`, la alerta pasa a `gestionada`, se guarda la resolución y se emite `COLEGIO_CASO_RESUELTO_POR_COMITE`.
- **SC-008**: Cada mutación de cuenta, integrante, escalamiento o resolución genera un `AuditLog` inmutable.
- **SC-009**: La migración de BD es aditiva: añade `cargo` a `IntegranteComite`, `colegioId`/`alertaColegioId` a `SolicitudComite`, `comiteColegioId` a `Usuario`, `COMITE_CONVIVENCIA` a `RolUsuario` y nuevas acciones de audit; no modifica `Curso` ni `Estudiante.cursoId`.

---

## Impacto en arquitectura

- **Modelo de datos**: migración aditiva que extiende tablas existentes (`IntegranteComite`, `SolicitudComite`, `Usuario`, `Colegio`, `AccionAudit`, `RolUsuario`) sin alterar `Curso` ni `Estudiante`.
- **DAL**: nuevos repositorios/servicios `ComiteConvivenciaService`, `ComiteConvivenciaIntegrantesService`, `ComiteConvivenciaBandejaService` y repositorios asociados, todos acotados por `colegioId`.
- **API**: nuevos endpoints bajo `/api/colegio/comite/**` y `/api/colegio/alertas/[id]/escalar`, con validación Zod y rate limiting.
- **UI**: nuevas páginas bajo `/dashboard/colegio/comite` (gestión de cuenta e integrantes) y `/dashboard/colegio/comite/casos` (bandeja y detalle).
- **Auth / proxy**: `COMITE_CONVIVENCIA` se reconoce como rol de colegio, con home propio (`/dashboard/colegio/comite/casos`) y acceso restringido a `/dashboard/colegio/comite/**`, `/api/colegio/comite/**` y rutas de sesión.
- **Permisos**: nuevos módulos `colegios_comite` y `colegios_comite_bandeja` en `CATALOGO_MODULOS`; grants por defecto para `SCHOOL_ADMIN` y `COMITE_CONVIVENCIA`.
- **Auditoría**: nuevas acciones `COLEGIO_COMITE_*` y `COLEGIO_CASO_*` en `AccionAudit`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar el rol, tablas, rutas y pantallas nuevas.

---

## Assumptions

- Se reutiliza `IntegranteComite` para los integrantes documentados y `SolicitudComite` para los casos escalados, acotándolos por `colegioId`.
- Se añade un nuevo rol `COMITE_CONVIVENCIA` distinto de `COMITE_VALIDACION` (que sigue siendo el comité de validación de la plataforma).
- Un colegio tiene exactamente una cuenta compartida `COMITE_CONVIVENCIA`; los integrantes no inician sesión.
- El comité de convivencia **no corrige la categoría** de la clasificación IA; solo documenta una decisión institucional y cierra el caso.
- El rector (`SCHOOL_ADMIN`) es el único rol que administra la cuenta e integrantes del comité.
- La bitácora del caso reusa `SeguimientoCaso`/`NotaSeguimiento` (SPEC-159); el comité puede leer y agregar notas.
- El proxy y el layout del colegio se actualizan para soportar el nuevo rol sin alterar el flujo de `SCHOOL_ADMIN`.
- No se requiere notificación por email al escalar (puede añadirse en Fase G); en esta fase el comité accede por login.

---

## Implementación

*Sección reservada para el cierre. Se completará tras la implementación con commits, gates y evidencia.*
