# Feature Specification: Identificadores — integridad + identidad (A-58 · SPEC-A)

**Feature Branch**: `work/pi-SPEC-320-identificadores-integridad-identidad`

**Created**: 2026-08-30

**Status**: IMPLEMENTADO

**Impacto en arquitectura:** ⚠️ *Superficie compartida (candado 22 v5): la migración D agrega valores al enum Prisma `AccionAudit` (`ADMIN_TIPO_DOCUMENTO_CREADO/EDITADO`); A-56 también agrega uno (`USUARIO_CAMBIO_PASSWORD`). Los `ALTER TYPE ADD VALUE` no chocan, pero el bloque `enum AccionAudit {}` de schema.prisma sí da conflicto de merge — el segundo PR debe rebasear conservando LOS DOS valores.* Cambia el esquema de datos (nueva tabla catálogo `TipoDocumento`; denormalización de `colegioId` en `IdentificadorAlumno`; campos de identidad obligatorios en `Profesor`; reordenamiento asimétrico de las constraints de unicidad de los tres identificadores con índices parciales `WHERE estado='activo'` y `NULLS NOT DISTINCT`; conversión del vocabulario del comité al catálogo). Tres migraciones aditivas en secuencia (A catálogo → B unicidad → C identidad profesor). Nuevo servicio `identificador-unicidad.ts` centraliza la validación cross-sujeto. Requiere regenerar `docs/architecture/` y dejar `npm run arch:check` en verde en el PR. No toca el proxy, la navegación ni el stack; no afecta los 5 índices críticos HNSW/GIN. La búsqueda cross-tenant de `alertas.ts` no se modifica.

**Radicado**: 002-PI-220 · SPEC-320 · A-58 (SPEC-A) · I-213 · R-032

**Input**: Recorrido #1 manual de Jelkin. Tres migraciones en secuencia: (2.1) unicidad del identificador de red social por colegio cruzando los tres sujetos; (2.2) documento de identidad del profesor obligatorio sin compatibilidad hacia atrás; (2.3) catálogo único de tipos de documento en BD, editable por el admin.

## Contexto del problema

El **identificador de red social es la llave del producto**: es contra lo que el motor cruza cuando llega un reporte. Hoy la unicidad de cada identificador incluye el sujeto (`[profesorId, tipo, valor, plataformaId]` en profesor, e igual en acudiente y estudiante), así que la única regla existente es "un mismo sujeto no repite SU propio identificador" — la regla que importa (un identificador no puede pertenecer a dos personas distintas del mismo colegio) nunca se escribió. Agravante: `plataformaId` es nullable y en PostgreSQL las filas con NULL no colisionan en un índice único, por lo que sin plataforma la BD no protege nada. **Consecuencia ya activa:** cuando dos personas del mismo colegio comparten un identificador, el pipeline de alertas genera **una alerta duplicada por cada persona** que lo comparta.

Además, el **profesor no tiene documento de identidad** (el modelo solo guarda nombre, apellidos, email y teléfono), y existen **tres vocabularios distintos** para "tipo de documento" —ninguno administrable— que describen lo mismo con claves diferentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un identificador pertenece a una sola persona por colegio (Priority: P1)

Cuando un rector (SCHOOL_ADMIN) registra el identificador de red social de un estudiante, profesor o acudiente, el sistema debe garantizar que ese identificador identifique a **una sola persona dentro del colegio**. Si el rector intenta vincular un identificador que ya está en uso por otra persona del mismo colegio, el sistema **le dice a quién pertenece (nombre y rol) y lo deja decidir**, sin bloquearlo en seco. El mismo identificador **sí** puede repetirse entre colegios distintos (una misma persona en dos colegios).

**Why this priority**: Es la llave del producto. Sin esta regla el motor cruza reportes contra identificadores ambiguos y genera alertas duplicadas —un defecto ya activo en producción—. Es la migración que corrige la integridad del dato más importante del sistema.

**Independent Test**: Registrar el mismo identificador de red social en dos personas del mismo colegio y verificar que el sistema avisa a quién pertenece; registrarlo en dos colegios distintos y verificar que se permite; disparar un reporte contra ese identificador y verificar que se genera **una sola alerta**, no una por persona.

**Acceptance Scenarios**:

1. **Given** un estudiante ya tiene registrado el nick `@juanito` en el colegio X, **When** el rector intenta registrar `@juanito` en un profesor del colegio X, **Then** el sistema muestra un aviso indicando que ese identificador ya pertenece a "[nombre del estudiante] (Estudiante)" y ofrece continuar o cancelar (no lo rechaza automáticamente).
2. **Given** el rector confirma el aviso, **When** guarda, **Then** el identificador queda vinculado a ambas personas y se registra la decisión en auditoría.
3. **Given** un profesor del colegio X tiene el nick `@juanito`, **When** el rector de un colegio Y **distinto** registra `@juanito` en uno de sus estudiantes, **Then** el sistema lo permite sin aviso (los colegios son tenants aislados).
4. **Given** un mismo sujeto ya tiene registrado un identificador exacto (mismo tipo, valor y plataforma), **When** se intenta registrar el idéntico de nuevo en ese mismo sujeto, **Then** el sistema lo rechaza como duplicado exacto (protección dura de BD).
5. **Given** dos personas del colegio X comparten el identificador `+573001112233`, **When** llega un reporte comunitario contra `+573001112233`, **Then** el colegio X recibe **una sola** alerta institucional, no una por persona.
6. **Given** un identificador registrado sin plataforma (plataformaId vacío), **When** se intenta registrar el mismo valor sin plataforma en la misma persona, **Then** el sistema lo detecta como duplicado (el NULL de plataforma no evade la protección).

---

### User Story 2 - El profesor tiene identidad completa y verificable (Priority: P1)

Cuando el rector da de alta un profesor, el sistema exige los datos de identidad: **tipo de documento, número de documento, año de nacimiento, sexo, teléfono y email**, todos obligatorios. El número de documento (junto con su tipo) identifica de forma única a un profesor dentro del colegio. No se admiten fichas de profesor incompletas.

**Why this priority**: El profesor es un sujeto de riesgo del producto igual que estudiante y acudiente; sin documento de identidad no hay llave humana confiable. La campaña arranca de cero (se borra la data antes), por lo que exigirlo desde el inicio es el momento más barato: no hay históricos que migrar.

**Independent Test**: Intentar crear un profesor sin documento y verificar que el sistema no lo permite; crear dos profesores con el mismo tipo+número en el mismo colegio y verificar que el segundo es rechazado.

**Acceptance Scenarios**:

1. **Given** el formulario de alta de profesor, **When** el rector intenta guardar sin tipo de documento, número, año de nacimiento, sexo, teléfono o email, **Then** el sistema rechaza el alta indicando el campo faltante.
2. **Given** un profesor ya registrado con documento (tipo CC, número 123) en el colegio X, **When** el rector intenta crear otro profesor con el mismo tipo CC y número 123 en el colegio X, **Then** el sistema lo rechaza por documento duplicado.
3. **Given** dos colegios distintos, **When** cada uno registra un profesor con el mismo tipo+número de documento, **Then** ambos se permiten (la unicidad del documento es por colegio).
4. **Given** dos profesores registrados con nombres que difieren solo en mayúsculas ("JUAN PÉREZ" y "Juan Pérez"), **When** el sistema busca duplicados por nombre y apellidos, **Then** los reconoce como el mismo (búsqueda normalizada, insensible a mayúsculas/acentos).

---

### User Story 3 - Un solo catálogo de tipos de documento, administrable (Priority: P2)

El administrador de plataforma gestiona un **único catálogo de tipos de documento** almacenado en la base de datos, editable (agregar, activar/desactivar). Los tres sujetos —estudiante, profesor e integrante de comité— consumen ese mismo catálogo. El catálogo se siembra con los tipos de la norma colombiana.

**Why this priority**: Elimina la triplicación de vocabularios (hoy un mismo tipo se llama `CC` en un lado y `CEDULA_CIUDADANIA` en otro) y da al admin control sin tocar código. Es habilitador de §2.1 y §2.2 (les da el vocabulario común), pero puede entregarse detrás de ellas.

**Independent Test**: Agregar un tipo de documento desde configuración de admin y verificar que aparece en los formularios de estudiante, profesor y comité; verificar que los datos existentes (`CC`, `CEDULA_CIUDADANIA`) quedan mapeados a una sola clave del catálogo.

**Acceptance Scenarios**:

1. **Given** el panel de administración, **When** el admin agrega un nuevo tipo de documento, **Then** ese tipo queda disponible en los formularios de los tres sujetos.
2. **Given** el catálogo sembrado, **When** se consultan los tipos disponibles, **Then** incluye registro civil, tarjeta de identidad, cédula de ciudadanía, cédula de extranjería, pasaporte, PEP/PPT, NIT y otro.
3. **Given** datos previos con vocabularios distintos (`CC` en estudiante, `CEDULA_CIUDADANIA` en comité), **When** se aplica la unificación, **Then** ambos quedan referidos a la misma clave de catálogo ("cédula de ciudadanía").
4. **Given** el admin desactiva un tipo de documento, **When** un rector abre el formulario de alta, **Then** ese tipo ya no aparece como opción seleccionable (pero los registros que ya lo usaban se conservan).

---

### Edge Cases

- **Identificador compartido legítimo dentro del colegio**: un profesor cuyo hijo estudia en el mismo colegio es la misma persona con el mismo Instagram, presente en dos sujetos. El warn-con-override lo permite tras confirmación del rector (razón de la decisión del CEO para la opción A).
- **plataformaId NULL**: la unicidad no puede confiar en que dos NULL colisionen en PostgreSQL; debe resolverse con un valor centinela o índice equivalente para que "sin plataforma" cuente como un caso único.
- **Migración sobre datos**: la migración corre contra los datos existentes de producción *antes* del reset (Fábrica verificó: cero duplicados hoy). Debe verificarse el estado de los datos antes de cada una de las tres migraciones.
- **Documento del profesor en blanco tras el reset**: no aplica — no hay backfill ni nullable de transición; los registros nacen completos.
- **Edición de un identificador** (no solo alta): la regla de unicidad cross-sujeto aplica también al editar un identificador existente, excluyendo el propio registro.
- **Carga masiva de estudiantes** (importador y carga unificada): la validación de unicidad cross-sujeto debe aplicar también en los flujos de carga por lote, no solo en el alta individual.

## Requirements *(mandatory)*

### Functional Requirements

**§2.1 — Unicidad del identificador (opción A, cerrada por el CEO)**

- **FR-001**: El sistema DEBE garantizar que, dentro de un mismo colegio, un identificador de red social exacto (mismo tipo, valor y plataforma) no se repita en el mismo sujeto — protección dura de base de datos por tabla, dentro del colegio.
- **FR-002**: El sistema DEBE, al registrar o editar un identificador, detectar si el mismo valor ya está en uso por **otra persona del mismo colegio** cruzando los tres sujetos (estudiante, profesor, acudiente) y, en ese caso, informar a quién pertenece (nombre y rol) y permitir al rector decidir si continúa (warn con override), sin bloquear la operación automáticamente.
- **FR-003**: El sistema DEBE permitir que un mismo identificador exista en colegios distintos sin advertencia (aislamiento por tenant); la búsqueda cross-tenant que alimenta las alertas del motor NO se modifica.
- **FR-004**: El sistema DEBE resolver el caso de identificador sin plataforma de modo que "sin plataforma" cuente como un caso único y no evada la protección de unicidad (los NULL no deben tratarse como distintos entre sí).
- **FR-005**: El sistema DEBE registrar en la base de datos el colegio de cada identificador de estudiante (dato hoy ausente en esa tabla) para poder aplicar la unicidad por colegio en los tres sujetos de forma uniforme.
- **FR-006**: El sistema DEBE generar **una sola** alerta institucional por colegio cuando un reporte coincide con un identificador, aun si más de una persona del colegio lo comparte.
- **FR-007**: El sistema DEBE aplicar la validación de unicidad cross-sujeto en todos los puntos de entrada de identificadores: alta individual, edición, carga masiva por lote y carga unificada.

**§2.2 — Documento de identidad del profesor (obligatorio, sin compatibilidad hacia atrás)**

- **FR-008**: El sistema DEBE exigir, al crear un profesor, los campos de identidad: tipo de documento, número de documento, año de nacimiento, sexo, teléfono y email — todos obligatorios, sin valores nulos de transición ni backfill.
- **FR-009**: El sistema DEBE garantizar que la combinación tipo+número de documento sea única por colegio (llave humana), complementaria a la llave de red social del producto.
- **FR-010**: El sistema DEBE rechazar el alta de un profesor cuya identidad esté incompleta y no DEBE ofrecer estados de "ficha incompleta".
- **FR-011**: El sistema DEBE normalizar la búsqueda de profesores por nombre y apellidos dentro del colegio para que sea insensible a mayúsculas y acentos (hoy compara de forma exacta y sensible a mayúsculas).

**§2.3 — Catálogo único de tipos de documento**

- **FR-012**: El sistema DEBE almacenar los tipos de documento en un único catálogo en base de datos, con clave única, nombre, categoría y estado activo/inactivo, editable por el administrador de plataforma.
- **FR-013**: El sistema DEBE sembrar el catálogo de forma idempotente con los tipos de la norma colombiana: registro civil, tarjeta de identidad, cédula de ciudadanía, cédula de extranjería, pasaporte, PEP/PPT, NIT y otro.
- **FR-014**: El sistema DEBE hacer que los tres sujetos (estudiante, profesor, integrante de comité) consuman el mismo catálogo, eliminando los vocabularios paralelos.
- **FR-015**: El sistema DEBE migrar los datos existentes al vocabulario unificado, de modo que claves equivalentes (`CC` de estudiante y `CEDULA_CIUDADANIA` de comité) queden referidas a la misma entrada del catálogo.
- **FR-016**: El administrador DEBE poder agregar y activar/desactivar tipos de documento; los tipos desactivados no se ofrecen en formularios nuevos, pero los registros que ya los usaban se conservan.

**Restricciones transversales**

- **FR-017**: Cada una de las tres migraciones DEBE verificar el estado de los datos antes de ejecutarse y ser segura sobre los datos existentes de producción (no destructiva salvo la unificación de vocabulario prevista).
- **FR-018**: El sistema DEBE registrar en auditoría las decisiones de override de identificador compartido y las altas de profesor con su documento.

### Key Entities *(include if feature involves data)*

- **Identificador (de estudiante / profesor / acudiente)**: valor de red social, teléfono o nick asociado a una persona; atributos tipo, valor, plataforma (opcional), estado (activo/inactivo) y colegio. La unicidad relevante es (colegio, valor) cruzando los tres sujetos, con override humano.
- **Profesor**: persona docente de un colegio; ahora con identidad completa (tipo y número de documento, año de nacimiento, sexo, teléfono, email) además de nombre y apellidos. Llave humana: (colegio, tipo+número de documento).
- **Tipo de documento (catálogo)**: entrada administrable con clave única, nombre, categoría y estado activo; fuente única de verdad del vocabulario de documentos para los tres sujetos.
- **Alerta institucional**: aviso que un colegio recibe cuando un reporte coincide con un identificador registrado; debe ser única por colegio aunque varias personas compartan el identificador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los intentos de registrar un identificador ya usado por otra persona del mismo colegio produce un aviso que nombra a quién pertenece (nombre y rol), y ninguno se bloquea automáticamente.
- **SC-002**: Un reporte que coincide con un identificador compartido por N personas del mismo colegio genera exactamente **1** alerta institucional (hoy genera N).
- **SC-003**: El 100% de los identificadores de los tres sujetos quedan protegidos por colegio, incluidos los registrados sin plataforma.
- **SC-004**: El 100% de las altas de profesor exigen identidad completa; ningún profesor puede crearse sin documento, y no existen registros de profesor con identidad parcial.
- **SC-005**: Existe un único catálogo de tipos de documento; el número de vocabularios paralelos para "tipo de documento" pasa de 3 a 1, y un tipo agregado por el admin aparece en los formularios de los tres sujetos.
- **SC-006**: Las tres migraciones se aplican sobre los datos de producción sin pérdida no prevista y sin fallar por datos preexistentes.

## Assumptions

- **La data se borra y se arranca de cero después del deploy** (decisión de Jelkin; el reset-piloto lo corre el CEO *después* de desplegar). Por eso los campos de identidad del profesor nacen obligatorios sin nullable de transición ni backfill.
- **§2.1 se implementa con la opción A**, cerrada por el CEO el 2026-08-30: `@@unique` duro por-tabla dentro del colegio + cruce entre-sujetos como warn-con-override en aplicación. Razón: un profesor cuyo hijo estudia en el mismo colegio es la misma persona con el mismo identificador en dos sujetos —caso legítimo y común— y un bloqueo duro cross-sujeto se lo rompería al rector.
- **La búsqueda cross-tenant que alimenta las alertas del motor es correcta y no se toca** (mismo humano reportado en varios colegios debe avisar a cada uno).
- **Fuera de alcance (va en SPEC-B / 002-PI-221)**: botones de duplicados en UI, guardas de profesor inactivo y su UI, rename de "baja" a "inactivar", columna de identificadores activos. También fuera: guardianes de middleware (A-56), comité (A-57), aviso de cambio de clave (A-59).
- El catálogo sigue el patrón de catálogo ya probado en el proyecto (clave única, nombre, categoría, estado activo).

**Diferido a radicado propio (decisión del CEO 2026-08-30) — NO es olvido:**
- **Conversión de `IntegranteComite.tipoIdentificacion` (enum Prisma) → catálogo** queda FUERA de esta SPEC. Motivo: es una migración de **tipo de columna sobre tabla viva** (drop del enum `TipoIdentificacionIntegrante` + `@@index`), que toca **9 archivos / 23 usos** + la capa de types/services/repos del comité — materialmente más que lo estimado (candado 17 disparado). Merece su propio análisis línea por línea. **El catálogo ya siembra `CC`/`CE`, así que la equivalencia con el vocabulario del comité (`CEDULA_CIUDADANIA`/`CEDULA_EXTRANJERIA`) queda puesta**; lo único pendiente es re-apuntar la columna del comité al catálogo, sin pérdida de dato. Fábrica registró el follow-up del lado de gestión. En esta SPEC, estudiante y profesor SÍ consumen el catálogo; el comité conserva su enum hasta el radicado de conversión.

**Política de unicidad en carga por lote (candado 15v4):** en carga masiva no hay un humano que confirme un override por fila, así que TODA colisión (dura o warn) se **omite y se reporta** (contador `identificadoresOmitidosPorConflicto`), sin tumbar el batch; el rector la resuelve luego por la UI interactiva. En el wizard atómico (creación curso+estudiantes) la colisión **aborta con mensaje claro** (su UI de override por identificador es SPEC-B).

**Ficha de identidad del profesor (§2.2) es SPEC-A:** el formulario de alta/edición de la pantalla Profesores incluye los campos de identidad (tipo de documento del catálogo, número, año, sexo, teléfono, email) — sin él, el guard de backend bloquearía toda alta de profesor. La UX prolija del quick-create del wizard (botón/redirect en vez de 400) sí es SPEC-B.
- La verificación de evidencia se hace en producción con un ejercicio real y se publica en el PR (Jelkin prueba; Fábrica audita).
