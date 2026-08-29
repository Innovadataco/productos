# Feature Specification: SPEC-152 — Duplicar curso al año siguiente

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-10

**Status**: DESARROLLO

**Input**: Instructivo 002-PI-058, brief §7.3. El rector/secretaría necesita clonar un curso (estudiantes + identificadores activos) al periodo siguiente de forma atómica, sin perder ni duplicar datos, respetando el tenant y con trazabilidad de auditoría.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Duplicar curso completo al año siguiente (Priority: P1)

Como rector/secretaría, quiero duplicar un curso con todos sus estudiantes e identificadores activos al año siguiente, para no tener que crear todo de nuevo manualmente.

**Why this priority**: Es la entrega central de la spec y el dolor del puente (re-crear cursos año a año).

**Independent Test**: un SCHOOL_ADMIN llama `POST /api/colegio/cursos/[id]/duplicar` sobre un curso con 2 estudiantes (uno con 2 identificadores) y recibe 201 con el nuevo curso, 2 estudiantes nuevos y 2 identificadores nuevos; el curso origen queda intacto.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN y un curso propio con estudiantes e identificadores activos, **When** llama al endpoint, **Then** se crea un nuevo curso en el mismo colegio con `anioLectivo` incrementado en 1 (o año actual + 1 si no tenía), nombre y grado copiados, y devuelve 201 con el resumen.
2. **Given** el curso origen, **Then** todos sus estudiantes activos se clonan en el nuevo curso con nombre, apellidos, documento y acudientes.
3. **Given** los estudiantes clonados, **Then** sus identificadores activos se clonan preservando tipo, valor, plataforma y etiqueta de relación.
4. **Given** una falla a mitad del proceso, **Then** no persiste nada (atomicidad `withUnitOfWork`): ni curso, ni estudiantes, ni identificadores.

---

### User Story 2 — Evitar duplicados y mantener origen intacto (Priority: P1)

Como plataforma, quiero que la duplicación sea segura: no debe pisar un curso existente ni modificar el origen.

**Why this priority**: Previene pérdida de datos históricos y duplicados accidentales.

**Independent Test**: si ya existe un curso con el mismo nombre, grado y nuevo `anioLectivo`, el endpoint devuelve 409 y no crea nada.

**Acceptance Scenarios**:

1. **Given** un curso destino que ya existe (mismo `colegioId`, nombre, grado, nuevo anioLectivo), **When** se intenta duplicar, **Then** responde 409 con mensaje humano y cero filas creadas.
2. **Given** el duplicado exitoso, **Then** el curso origen y sus estudiantes/identificadores NO se modifican.
3. **Given** un curso de OTRO colegio, **When** se intenta duplicar, **Then** responde 404 (no revela existencia) y no crea nada.

---

### User Story 3 — Trazabilidad e interfaz (Priority: P2)

Como rector, quiero ver un botón en la ficha del curso para duplicarlo y dejar rastro de auditoría.

**Why this priority**: Descubribilidad y trazabilidad institucional.

**Independent Test**: la vista `/dashboard/colegio/cursos/[id]` muestra un botón "Duplicar al año siguiente"; al hacer clic se confirma y, tras éxito, navega al nuevo curso.

**Acceptance Scenarios**:

1. **Given** la ficha del curso, **Then** el botón de duplicar es visible para SCHOOL_ADMIN.
2. **Given** el clic en duplicar, **When** confirma, **Then** se registra `AuditLog` con acción `COLEGIO_CURSO_DUPLICADO` y metadatos (cursoOrigenId, cursoNuevoId, cantidadEstudiantes, cantidadIdentificadores).
3. **Given** el duplicado exitoso, **Then** la UI navega a la ficha del nuevo curso.

## Edge Cases

- **Curso sin estudiantes**: se crea el curso destino vacío.
- **Curso sin `anioLectivo`**: se usa el año actual + 1 como nuevo `anioLectivo`.
- **`anioLectivo` no numérico**: se intenta parsear; si no es posible, se usa año actual + 1.
- **Identificadores inactivos**: no se migran.
- **Estudiantes inactivos**: no se migran.
- **Profesor titular**: no se copia (el titular del año siguiente se asigna manualmente; evita asignaciones erróneas).
- **Duplicado parcial**: un mismo estudiante con el mismo nombre/apellidos en el curso destino genera 409 (mismo criterio que creación unificada).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Endpoint `POST /api/colegio/cursos/[id]/duplicar` para `SCHOOL_ADMIN`.
- **FR-002**: Validación de propiedad del curso: 404 si no pertenece al colegio del usuario (tenant-first, SPEC-134).
- **FR-003**: Atomicidad con `withUnitOfWork` (SPEC-137): todo o nada.
- **FR-004**: Cálculo del nuevo `anioLectivo`: numérico +1; fallback año actual +1.
- **FR-005**: Verificación de duplicado destino (`colegioId+nombre+grado+anioLectivo`) → 409 humano.
- **FR-006**: Clonación de estudiantes activos con acudientes (máximo 2 por estudiante).
- **FR-007**: Clonación de identificadores activos por estudiante.
- **FR-008**: No se copia `profesorTitularId` al curso destino.
- **FR-009**: Auditoría `COLEGIO_CURSO_DUPLICADO` con metadatos (sin PII).
- **FR-010**: Tests de integración: 201 con clonación completa, 404 curso ajeno, 409 destino ya existe, atomicidad con fallo provocado.
- **FR-011**: Botón en `/dashboard/colegio/cursos/[id]` para duplicar con confirmación y navegación al nuevo curso.
- **FR-012**: I-29 intacto; no se toca `src/lib/ai/**`; `arch:check` y `tokens:check` verdes.

### Key Entities

- **DuplicarCursoInput**: `{ cursoId }` (vía ruta).
- **DuplicarCursoResultado**: `{ curso: Curso, resumen: { estudiantesClonados, identificadoresClonados } }`.

## Success Criteria *(mandatory)*

- **SC-001**: Duplicar un curso con estudiantes + identificadores crea TODO en una sola transacción.
- **SC-002**: Fallo a mitad deja la BD exactamente igual (0 filas nuevas).
- **SC-003**: A/B: un SCHOOL_ADMIN no puede duplicar un curso de otro colegio.
- **SC-004**: Duplicado destino preexistente devuelve 409 y no crea nada.
- **SC-005**: `tsc`, `lint`, `tokens:check`, `arch:check`, `test:coverage` y `build` verdes.

## Assumptions

- El curso destino se identifica por (`colegioId`, `nombre`, `grado`, `anioLectivo`) usando el unique existente en el modelo `Curso`.
- Solo se clonan entidades activas del curso origen.
- El profesor titular se asigna después en el curso destino (manualmente o por otra funcionalidad).
- La UI reutiliza el componente de confirmación existente.

## Impacto en arquitectura:

Añade endpoint (`/api/colegio/cursos/[id]/duplicar`), valor enum `AccionAudit.COLEGIO_CURSO_DUPLICADO` (migración aditiva), repositorio/método de duplicación y botón en la ficha del curso. No modifica el modelo de datos salvo el enum aditivo. No toca el motor de IA.

## Implementación

- **Migración aditiva**: `prisma/migrations/20260809193218_add_duplicar_curso_audit/migration.sql` añade `COLEGIO_CURSO_DUPLICADO` a `AccionAudit`.
- **Servicio**: `src/lib/colegio/duplicar-curso.ts` — clonación atómica con `withUnitOfWork`; no copia profesor titular; calcula `anioLectivo` siguiente; audita en la misma transacción.
- **Endpoint**: `src/app/api/colegio/cursos/[id]/duplicar/route.ts` — `SCHOOL_ADMIN`, vigencia, rate limit, 201/404/409.
- **Tests**: `src/app/api/colegio/cursos/[id]/duplicar/route.test.ts` — 5 tests de integración.
- **UI**: botón "Duplicar al año siguiente" en `/dashboard/colegio/cursos/[id]` (`CursoEscritorioClient.tsx` + `CursoHeader.tsx`), con confirmación y navegación al curso nuevo.
- **Artefactos**: `docs/architecture/02-roles-capacidades.md` regenerado.
- **Cierre**: ver `cierre.md`.
