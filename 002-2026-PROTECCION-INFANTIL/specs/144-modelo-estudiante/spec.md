# Feature Specification: SPEC-144 — Modelo `Estudiante` expandido (rename desde `Alumno`)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-03

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058 (cola ux-rector-primero, SPEC-143…156; radica ZEUS).
Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v2.0 (§3 terminología que gobierna también
el código · §7.1 modelo `Estudiante` · §7.4 candados de datos · §10 mapa funcional,
orden 1) + Constitución §2.3 (multi-tenant). Verificado en fuente 2026-08-03: el modelo
`Alumno` actual tiene solo `nombre` (ni apellidos, ni documento, ni acudiente —
`prisma/schema.prisma:483`); las tablas físicas son `"Alumno"`, `"IdentificadorAlumno"`
y el enum físico `"EtiquetaRelacionAlumno"` (migración
`20260721060000_add_colegio_cursos_alumnos`); la cascada de código toca 29 archivos en
`src/` + `scripts/arch/generar-modelo-datos.ts`. Lo que NO existe: `apellidos`, datos
de contacto del acudiente (el corazón del producto según el brief §7.1: "cuando hay un
caso, el rector tiene que llamar a la casa YA") ni el rename que la terminología §3
exige en el código.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rename `Alumno → Estudiante` sin tocar una sola tabla física (Priority: P1)

Como plataforma, quiero que el modelo de datos y TODO el código hablen `Estudiante`
(la terminología del brief §3 gobierna el código, no solo la pantalla) sin que la base
de datos física cambie de nombre ni pierda una fila, de modo que el rename sea un
despliegue seguro y reversible.

**Why this priority**: Es la base de toda la cola 002-PI-058: las 13 specs siguientes
(Profesor, home, wizard, vista de curso…) se construyen sobre `Estudiante`. Si el
rename rompe datos o deja la cascada a medias, todo lo demás nace roto.

**Independent Test**: sobre una copia de la BD con datos, `prisma migrate deploy`
ejecuta SOLO cambios aditivos (cero `DROP`, cero `ALTER` destructivo, cero pérdida);
`migrate reset && migrate deploy && db seed` recrea todo desde cero; la suite completa
queda verde con los identificadores nuevos.

**Acceptance Scenarios**:

1. **Given** el schema migrado, **When** se inspeccionan los nombres físicos,
   **Then** la tabla sigue llamándose `"Alumno"` (`@@map("Alumno")`), la FK sigue
   siendo la columna `"alumnoId"` (`@map`) y el enum físico sigue siendo
   `"EtiquetaRelacionAlumno"` con el valor físico `'ALUMNO'` (`@@map`/`@map`) — el
   diff SQL del rename es vacío a nivel de estructura existente.
2. **Given** un identificador existente con `etiquetaRelacion = 'ALUMNO'` (físico),
   **When** se lee con el cliente Prisma nuevo, **Then** el valor se expone como
   `EtiquetaRelacionEstudiante.ESTUDIANTE` y al escribir `ESTUDIANTE` se persiste
   `'ALUMNO'` — los datos históricos se interpretan sin migración de valores.
3. **Given** la cascada de código completa, **When** se busca
   `Alumno|IdentificadorAlumno|EtiquetaRelacionAlumno` en `src/`, **Then** solo quedan
   referencias dentro de strings de mapeo (`@@map`/`@map` en el schema) y comentarios
   históricos/docstrings; cero identificadores de producto con el nombre viejo.
4. **Given** un despliegue limpio, **When** se corre
   `prisma migrate reset --force && prisma migrate deploy && prisma db seed` sobre la
   BD de test, **Then** todo se recrea y el seed corre sin error (reversibilidad
   verificada, candado §7.4).

---

### User Story 2 — Ficha del estudiante expandida con backfill idempotente (Priority: P1)

Como rector (vía las pantallas que llegan en specs posteriores), quiero que cada
estudiante pueda tener apellidos, documento y los datos de contacto de su acudiente,
de modo que cuando haya un caso el colegio pueda llamar a la casa de inmediato.

**Why this priority**: Es el dato que justifica la cola entera (brief §7.1). Sin las
columnas y el backfill, ninguna pantalla puede mostrar el teléfono del acudiente.

**Independent Test**: se crea un estudiante nuevo con `nombre` + `apellidos` y el
contacto del acudiente; se verifica que los estudiantes preexistentes quedan con
`apellidos = ""` y el resto en NULL tras migrar; una segunda corrida del
backfill/migración es no-op.

**Acceptance Scenarios**:

1. **Given** la migración aplicada sobre datos existentes, **When** se lee un
   estudiante creado antes de la SPEC, **Then** tiene `apellidos = ""`, documento en
   NULL y acudiente en NULL — sin excepciones ni filas huérfanas.
2. **Given** cualquier estado de la BD, **When** se re-ejecuta la migración/backfill,
   **Then** es no-op (idempotente por construcción: columnas con DEFAULT y NULLs, sin
   UPDATE de datos).
3. **Given** un alta nueva, **When** se crea un estudiante con `nombre`, `apellidos`
   y acudiente (nombre, relación, teléfono, email opcionales), **Then** todo se
   persiste en una sola escritura y se puede leer de vuelta íntegro.
4. **Given** un estudiante con dos acudientes, **When** se consulta, **Then** ambos
   están disponibles con su relación ("madre", "padre", "tía"…) y el sistema NO
   permite un tercero (máximo 2 por estudiante, brief §7.1).

---

### User Story 3 — Alta exige solo `nombre` + `apellidos` (Priority: P2)

Como secretaría del colegio, quiero crear estudiantes con el mínimo indispensable
(nombre y apellidos) y completar el resto después, de modo que el alta nunca se
convierta en un formulario que desalienta la adopción.

**Why this priority**: "Máxima adopción" es decisión del brief §7.1: obligatorios solo
nombre y apellidos; todo lo demás es opcional y **nunca bloquea el alta**. Cambia la
validación de los endpoints de creación existentes.

**Independent Test**: `POST /api/colegio/cursos/[id]/alumnos` sin `apellidos` → 400
con mensaje humano; con `apellidos` → 201; con campos opcionales ausentes → 201 igual.

**Acceptance Scenarios**:

1. **Given** un alta manual sin `apellidos`, **When** llega al endpoint, **Then**
   responde 400 con mensaje claro ("Falta el apellido del estudiante") y NO crea nada.
2. **Given** un alta manual con solo `nombre` + `apellidos`, **When** se envía,
   **Then** responde 201 y el estudiante queda activo con el resto de campos en
   NULL/vacío (la completitud se trabaja después con banner — specs de UI).
3. **Given** los tests existentes de los endpoints de alta, **When** la validación
   nueva entra, **Then** los tests se ACTUALIZAN para enviar `apellidos` (fortalecer
   el contrato, nunca debilitarlo: cero `skip`, cero assertions relajadas).

---

### Edge Cases

- **Estudiante preexistente sin apellidos**: tras el backfill queda `apellidos = ""`;
  las pantallas de completitud (specs posteriores) lo tratarán como "por completar".
  Ninguna consulta actual revienta por el string vacío.
- **Plantilla Excel vieja** (sin columna de apellidos) en la carga masiva: ver
  [NEEDS CLARIFICATION D4] — no se decide en esta spec sin ZEUS.
- **Locks en migración**: las columnas nuevas son `NULL` o `DEFAULT ''` constante →
  en PostgreSQL 16 son cambios de metadata (sin reescritura de tabla); la migración es
  segura sobre datos en caliente.
- **Worker / flujo de reportes**: la resolución identificador → alumno → colegio
  (`src/lib/colegio/alertas.ts`) y los patrones (`src/lib/colegio/patrones.ts`) usan
  las relaciones renombradas; la cascada los cubre y su comportamiento NO cambia.
- **Enum en código cliente**: cualquier comparación contra `'ALUMNO'` literal en
  `src/` se migra al enum nuevo; el valor físico persistido no cambia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE renombrar el modelo Prisma `Alumno → Estudiante` con
  `@@map("Alumno")`, conservando la tabla física y todas sus filas.
- **FR-002**: El sistema DEBE renombrar `IdentificadorAlumno → IdentificadorEstudiante`
  con `@@map("IdentificadorAlumno")` y el campo `alumnoId → estudianteId` con
  `@map("alumnoId")` (columna física intacta, incluido el `@@unique` existente).
- **FR-003**: El sistema DEBE renombrar el enum `EtiquetaRelacionAlumno →
  EtiquetaRelacionEstudiante` con `@@map("EtiquetaRelacionAlumno")` y el valor
  `ALUMNO → ESTUDIANTE` con `@map("ALUMNO")`; los demás valores (`MADRE`, `PADRE`,
  `PRIMO`, `TUTOR`, `OTRO`) quedan idénticos.
- **FR-004**: El sistema DEBE renombrar las relaciones afectadas
  (`Colegio.alumnos → estudiantes`, `Curso.alumnos → estudiantes`,
  `AlertaColegio.identificadorAlumno(Id) → identificadorEstudiante(Id)` con
  `@map("identificadorAlumnoId")`, `Plataforma.identificadoresAlumno →
  identificadoresEstudiante`) conservando los nombres físicos de columnas e índices.
- **FR-005**: El sistema DEBE agregar a `Estudiante`, de forma ADITIVA: `apellidos
  String @default("")`, `documentoTipo String?`, `documentoNumero String?` y el
  soporte de acudientes (según decisión D1), todo nullable o con default — cero
  columnas obligatorias sin default.
- **FR-006**: El backfill de existentes DEBE ser idempotente (segunda corrida =
  no-op) y reversible: `migrate reset && migrate deploy` recrea el schema completo.
- **FR-007**: El sistema DEBE soportar HASTA 2 acudientes por estudiante, cada uno con
  `nombre`, `relacion`, `telefono?`, `email?` (brief §7.1); nunca un tercero.
- **FR-008**: La cascada de código DEBE cubrir repositorios DAL, rutas API, lib
  (`colegio/alertas.ts`, `colegio/patrones.ts`, `colegio/carga/*`), componentes,
  `scripts/arch/generar-modelo-datos.ts` y tests: cero identificadores con el nombre
  viejo fuera de strings de mapeo y docstrings.
- **FR-009**: Toda query que toque `Estudiante`/`IdentificadorEstudiante`/acudientes
  DEBE mantener el patrón tenant-first E-1/SPEC-134 (`where { id, colegioId }` +
  conteo → 404 si 0 filas), con test A/B de dos colegios en cada verbo tocado.
- **FR-010**: Los endpoints de alta de estudiante (`POST
  /api/colegio/cursos/[id]/alumnos` y el flujo de carga masiva) DEBEN exigir `nombre`
  + `apellidos` y aceptar el resto como opcional; los errores responden 400 con
  mensaje humano (tono del brief §4.6).
- **FR-011**: Todo cambio de schema DEBE regenerar `docs/architecture/01-modelo-datos.md`
  y dejar `npm run arch:check` en VERDE en el mismo PR.
- **FR-012**: Esta SPEC NO cambia ninguna pantalla visible ni expone dato nuevo al
  cliente: las pantallas actuales siguen funcionando igual; los campos nuevos se
  consumen desde SPEC-146/147 en adelante. I-29 intacto: ningún score se expone.

### Key Entities

- **Estudiante** (hoy `Alumno`, tabla física `"Alumno"`): estudiante de un curso de un
  colegio. Nuevos: `apellidos`, `documentoTipo?`, `documentoNumero?`, acudientes.
  Obligatorios al alta: solo `nombre` + `apellidos`.
- **IdentificadorEstudiante** (hoy `IdentificadorAlumno`, tabla física
  `"IdentificadorAlumno"`): identificador digital (nick, gamer tag, teléfono) de un
  estudiante, con `etiquetaRelacion` (`ESTUDIANTE` | familiar).
- **Acudiente del estudiante** (modelado pendiente de decisión D1): hasta 2 contactos
  por estudiante con nombre, relación, teléfono y email.

## Decisiones pendientes de ZEUS (compuerta §4)

> Lo que el brief no fija, ODIN no lo inventa. Cada punto lleva recomendación; ZEUS
> resuelve en la compuerta y la spec se ajusta antes de `/speckit.tasks`.

- **D1 — Modelado de los 2 acudientes.** El brief §7.1 lista campos de "acudiente
  principal" y exige "hasta 2 acudientes/padres", pero no dice si van planos en la
  tabla o en tabla hija.
  - **A (recomendada)**: modelo hijo nuevo `AcudienteEstudiante` (`estudianteId`,
    `nombre`, `relacion`, `telefono?`, `email?`, `orden` 1|2, `@@unique([estudianteId,
    orden])`) — normalizado, el tope de 2 es un constraint, y SPEC-147 lo lee con un
    `include` en la misma query (sin N+1).
  - **B**: 8 columnas planas (`acudienteNombre…` + `acudiente2Nombre…`) en `"Alumno"`
    — cero joins, pero duplica columnas y el tope de 2 se valida a mano.
- **D2 — Paths de URL.** Mantener `/api/colegio/alumnos/*` y
  `/dashboard/colegio/alumnos/*` en esta SPEC (**recomendado**: el brief solo exige el
  rename en código/modelo; las pantallas y rutas viejas las reemplazan SPEC-146/147
  con redirects) — o renombrar paths ahora (rompe clientes/E2E por cero beneficio de
  usuario).
- **D3 — `documentoTipo`.** String libre validado por Zod con set cerrado
  (`TI`, `CC`, `CE`, `PASAPORTE`, `OTRO`) (**recomendado**: el enum existente
  `TipoIdentificacionIntegrante` NO tiene TI —tarjeta de identidad, el documento
  típico del menor— y es del módulo comité) — o enum nuevo en BD.
- **D4 — Plantilla Excel vieja sin columna `apellidos`.** (a) Rechazar filas sin
  apellidos con el flujo de "filas con problemas" del brief §5.4 (**consistente con
  "obligatorio al alta"**, pero exige nueva plantilla); (b) aceptarlas con
  `apellidos = ""` y banner de completitud (**recomendada**: máxima adopción, no
  bloquea; la completitud se resuelve después).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `prisma migrate deploy` sobre una copia de la BD con datos aplica el
  rename con diff físico CERO en estructura existente (solo `ADD COLUMN` aditivos) y
  `migrate reset && migrate deploy && db seed` recrea todo en la BD de test.
- **SC-002**: Suite completa verde (`npm run test:coverage`) con igual o mayor número
  de tests/assertions que antes del rename — cero tests debilitados, saltados o
  borrados.
- **SC-003**: `grep -r "Alumno" src/` no devuelve ningún identificador de producto
  (solo strings de mapeo `@@map`/`@map` y comentarios históricos).
- **SC-004**: `npm run arch:check` VERDE con `01-modelo-datos.md` regenerado en el
  mismo commit que el cambio de schema.
- **SC-005**: Alta de estudiante sin `apellidos` → 400 con mensaje humano en todos los
  verbos de creación; con solo `nombre` + `apellidos` → 201.
- **SC-006**: Gate completo local (tsc && lint && test:coverage && build &&
  arch:check) verde y CI del HEAD post-merge = success.

## Assumptions

- No hay UI nueva ni cambios visibles: las pantallas que consumen los campos llegan en
  SPEC-143/146/147 (mapa §10 del brief).
- El worker y el motor de clasificación (`src/lib/ai/**`) NO se tocan; la cascada en
  `alertas.ts`/`patrones.ts` es solo de nombres, sin cambio de comportamiento.
- Las migraciones históricas (`prisma/migrations/**`) NO se editan: el rename se
  expresa en el schema con `@@map`/`@map` y una migración nueva aditiva.
- Los paths de URL actuales se conservan (salvo que D2 decida lo contrario).
- El seed (`prisma/seed.ts`) y los helpers de test (`reporte-test-utils.ts`,
  `test-utils.ts`) se actualizan dentro de la cascada para reflejar el modelo nuevo.
- SPEC-134 (repositorio tenant-first) y SPEC-137 (`withUnitOfWork`) son los patrones
  de referencia; esta spec no introduce patrones nuevos.

## Impacto en arquitectura

Impacto en arquitectura: **modifica el modelo de datos** — rename `Alumno →
Estudiante` / `IdentificadorAlumno → IdentificadorEstudiante` / enum
`EtiquetaRelacionAlumno → EtiquetaRelacionEstudiante` (todo con `@@map`/`@map`, cero
cambio físico destructivo) + columnas aditivas (`apellidos`, `documentoTipo`,
`documentoNumero`) + posible modelo nuevo `AcudienteEstudiante` (pendiente D1).
Obliga a regenerar `docs/architecture/01-modelo-datos.md` y pasar `arch:check` en el
mismo PR. No toca proxy, navegación ni stack.
