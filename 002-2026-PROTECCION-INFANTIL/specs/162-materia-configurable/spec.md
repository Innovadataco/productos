# Feature Specification: SPEC-162 — Materia configurable en cursos

**Feature Branch**: `work/002-pi-061`

**Created**: 2026-08-12

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-061. Fuentes vinculantes: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §3 (terminología) y §4.5 (Materia configurable). Patrones: SPEC-134 (tenant-first / DAL E-1), SPEC-137 (`withUnitOfWork`), SPEC-145 (soft delete), SPEC-146 (wizard unificado).

**Aclaración terminológica (Colombia)**:
- **Curso** = grado/grupo (ej. "6°A"). Es donde viven los estudiantes (`Estudiante.cursoId`).
- **Materia** = asignatura (ej. "Español", "Inglés", "Matemáticas").
- **CursoMateria** = vínculo que indica qué materias se dictan en un curso y quién las dicta.

Por lo tanto `Curso` **NO** se modifica: no recibe `materiaId`, `nombre` sigue siendo el grupo, y `Estudiante.cursoId` se mantiene intacto.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector configura el catálogo de materias de su colegio (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero crear, listar, editar y desactivar las materias que mi colegio dicta, para clasificar uniformemente la oferta académica.

**Why this priority**: es la pieza estructural sobre la que se construyen los vínculos curso-materia y, a futuro, el profesor multi-curso.

**Independent Test**: un rector puede listar las materias de su colegio, crear una nueva, editarla, inactivarla y reactivarla; otro rector no ve ni toca el catálogo ajeno.

**Acceptance Scenarios**:

1. **Given** un rector autenticado, **When** accede a `GET /api/colegio/materias`, **Then** recibe solo las materias activas de su colegio, ordenadas alfabéticamente.
2. **Given** un rector, **When** envía `POST /api/colegio/materias` con `nombre` único dentro de su colegio, **Then** se crea la materia en estado `activo` y se audita `COLEGIO_MATERIA_CREADA`.
3. **Given** un rector, **When** intenta crear dos materias con el mismo nombre en su colegio, **Then** recibe `409` con mensaje claro.
4. **Given** un rector, **When** envía `PATCH /api/colegio/materias/[id]` para renombrar una materia propia, **Then** se actualiza si no genera duplicado y se audita `COLEGIO_MATERIA_ACTUALIZADA`.
5. **Given** un rector, **When** envía `PATCH /api/colegio/materias/[id]/estado` con `inactivo`, **Then** la materia queda inactiva (soft delete) y ya no aparece en los selectores de curso-materia; no se borra físicamente.
6. **Given** un rector de otro colegio, **When** intenta leer/crear/editar/inactivar una materia ajena, **Then** recibe `404` sin tocar nada (A/B).

---

### User Story 2 — Rector asigna materias a un curso y define quién las dicta (Priority: P1)

Como rector quiero decir que en el curso "6°A" se dictan Español, Inglés y Matemáticas, y asignarle un profesor a cada materia, sin duplicar estudiantes ni romper el roster.

**Why this priority**: separar curso (grupo) de materia (asignatura) es el objetivo del brief §4.5; además resuelve gratis el profesor multi-curso pendiente del CEO (§4.4), porque un profesor puede aparecer en múltiples filas de `CursoMateria`.

**Independent Test**: un rector puede crear varios vínculos `CursoMateria` para un mismo curso, cada uno con materia y profesor distintos; no se duplican estudiantes.

**Acceptance Scenarios**:

1. **Given** un curso propio y una materia activa, **When** el rector envía `POST /api/colegio/cursos/[id]/materias` con `materiaId` y opcionalmente `profesorId`, **Then** se crea el vínculo y se audita `COLEGIO_CURSO_MATERIA_CREADA`.
2. **Given** un curso, **When** se le asignan tres materias distintas, **Then** el curso tiene tres filas de `CursoMateria`; `Estudiante.cursoId` sigue apuntando al curso, sin duplicados.
3. **Given** un intento de asignar la misma materia dos veces al mismo curso, **Then** se recibe `409`.
4. **Given** una materia inactiva o de otro colegio, **When** se intenta asignar, **Then** se recibe `400`/`404`.
5. **Given** un profesor de otro colegio, **When** se intenta asignar a un `CursoMateria`, **Then** se recibe `404`.
6. **Given** un vínculo existente, **When** el rector envía `PATCH /api/colegio/cursos/[cursoId]/materias/[id]` para cambiar el profesor, **Then** se actualiza y se audita `COLEGIO_CURSO_MATERIA_ACTUALIZADA`.
7. **Given** un vínculo existente, **When** el rector lo inactiva, **Then** `CursoMateria.estado` pasa a `inactivo` (soft delete) y se audita `COLEGIO_CURSO_MATERIA_ESTADO_CAMBIADO`.

---

### User Story 3 — El colegio ve las materias de cada curso (Priority: P2)

Como rector quiero ver en la ficha del curso qué materias se dictan y quién las dicta, para tener una visión completa del grupo sin confundir curso con asignatura.

**Why this priority**: cierra la usabilidad de la nueva semántica, pero no bloquea las funcionalidades centrales.

**Acceptance Scenarios**:

1. **Given** la ficha de un curso, **When** se abre, **Then** se muestra la lista de `CursoMateria` activos con materia y profesor.
2. **Given** un curso sin materias asignadas, **When** se abre, **Then** se muestra estado vacío con acción para agregar.
3. **Given** el listado de cursos, **When** se renderiza, **Then** no se altera: sigue mostrando curso (grado/grupo) tal como está.

---

### Edge Cases

- **Materia inactiva**: no se puede asignar a cursos; los vínculos existentes con materia inactiva se muestran marcados como históricos.
- **Curso inactivo**: no se pueden agregar nuevas materias, pero los vínculos históricos se conservan.
- **Profesor inactivo**: se muestra en el vínculo histórico pero no se puede asignar en nuevos vínculos.
- **Duplicados**: unique constraint `(cursoId, materiaId)` evita asignar dos veces la misma materia al mismo curso.
- **Cross-tenant**: todo `CursoMateria` se valida contra `colegioId` del curso; acceso a un vínculo ajeno devuelve 404.
- **Soft delete**: `CursoMateria` usa `estado` activo/inactivo; no se borra físicamente.
- **Seed inicial**: al crear un colegio se siembra un catálogo por defecto de materias.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al `SCHOOL_ADMIN` gestionar un catálogo de `Materia` propio de su colegio (CRUD + cambio de estado).
- **FR-002**: El sistema DEBE crear automáticamente un catálogo inicial de materias al dar de alta un colegio.
- **FR-003**: El modelo `Curso` NO DEBE modificarse; `Estudiante.cursoId` se mantiene intacto.
- **FR-004**: El sistema DEBE introducir `CursoMateria` como vínculo N:M entre `Curso` y `Materia`, con `profesorId` opcional.
- **FR-005**: El sistema DEBE garantizar que un curso no tenga la misma materia asignada dos veces (`@@unique([cursoId, materiaId])`).
- **FR-006**: El sistema DEBE validar que `cursoId`, `materiaId` y `profesorId` pertenezcan al mismo `colegioId`.
- **FR-007**: El sistema DEBE validar que `materiaId` esté activo al crear/editar un vínculo.
- **FR-008**: El sistema DEBE exponer endpoints REST para materias bajo `/api/colegio/materias`.
- **FR-009**: El sistema DEBE exponer endpoints REST para curso-materia bajo `/api/colegio/cursos/[cursoId]/materias`.
- **FR-010**: El sistema DEBE actualizar la UI del curso para mostrar y gestionar sus materias/profesores.
- **FR-011**: El sistema DEBE auditar las mutaciones sobre `Materia` y `CursoMateria`.

### Key Entities

- **Materia**: catálogo colegio-scoped. Atributos: `id`, `colegioId`, `nombre`, `estado` (activo/inactivo), `creadoEn`, `actualizadoEn`.
- **CursoMateria**: vínculo. Atributos: `id`, `cursoId`, `materiaId`, `profesorId` (opcional), `colegioId` (denormalizado), `estado` (activo/inactivo), `creadoEn`, `actualizadoEn`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un rector puede crear al menos 50 materias y listarlas en < 500 ms.
- **SC-002**: El 100% de las operaciones sobre materias y curso-materia respetan el aislamiento por `colegioId`.
- **SC-003**: Un curso puede tener N materias asignadas sin duplicar estudiantes ni alterar `Estudiante.cursoId`.
- **SC-004**: Los cursos existentes siguen funcionando exactamente igual; no hay cambios en `Curso` ni en `Estudiante.cursoId`.
- **SC-005**: Cada mutación de materia o curso-materia genera un `AuditLog` inmutable.
- **SC-006**: La migración de BD es aditiva: crea `Materia` y `CursoMateria`; no modifica `Curso` ni su unique constraint.

---

## Impacto en arquitectura:

- **Modelo de datos**: se añaden las tablas `Materia` y `CursoMateria` con migración aditiva; `Curso` y `Estudiante` no se alteran.
- **DAL**: nuevos repositorios `MateriaRepository` y `CursoMateriaRepository` (patrón tenant-first SPEC-134).
- **API**: endpoints bajo `/api/colegio/materias` y `/api/colegio/cursos/[cursoId]/materias`, con validación Zod y rate limiting.
- **UI**: nueva página `/dashboard/colegio/materias` y sección en la ficha del curso; se actualiza `ColegioSideNav` y `nav-items.ts`.
- **Auditoría**: acciones `COLEGIO_MATERIA_*` y `COLEGIO_CURSO_MATERIA_*` en `AccionAudit`.
- **Arquitectura**: la línea base generada (`docs/architecture/`) se regenera para reflejar tablas, rutas y pantallas nuevas.

---

## Assumptions

- `Curso` y `Estudiante.cursoId` no cambian en esta fase.
- `CursoMateria` resuelve de forma natural el profesor multi-curso (§4.4): un profesor puede dictar la misma materia en varios cursos o varias materias en el mismo curso.
- `SCHOOL_ADMIN` es el único rol que administra materias y curso-materia; se reusa el módulo `colegios_gestion`.
- No se requiere eliminación física de materias ni vínculos; la baja es soft delete por `estado`.
- El seed inicial de materias es una lista fija sugerida por el brief; el rector puede modificarla.

---

## Implementación

- **Commits en `work/002-pi-061`**: `57d8095d` especificación · `74d9d0ad` corrección tras compuerta ZEUS · `824388ea` schema+migración · `04e75c33` seed · `d564614c` `MateriaRepository` · `6164c5ea` endpoints materias · `86d056b1` `CursoMateriaRepository` · `56de7f81` endpoints curso-materia · `18c01ca8` frontend · `d0b1a400` arquitectura · `9f118e8a`+`c4c5fd6a` oráculos/README/tokens.
- **Merge a `feature/001-scaffolding`**: commit `6a83090d`.
- **Gate verde**: `npx tsc --noEmit` · `npm run lint` · `npm run tokens:check` · `npm run arch:check` · `npm run test` (1967 passed, 1 skipped) · `npm run build`.
- **I-49 / migración aditiva**: se crean `Materia` y `CursoMateria`; `Curso` y `Estudiante.cursoId` no se alteran. Sin `DROP`, `RENAME` ni cambios destructivos.
- **FR → evidencia**:
  - FR-001/002: `MateriaRepository` + endpoints `/api/colegio/materias` + seed `src/lib/colegio/materias-seed.ts`.
  - FR-003: `Curso` y `Estudiante.cursoId` intactos; unique constraint de `Curso` sin cambios.
  - FR-004/005/006/007: `CursoMateriaRepository` + endpoints `/api/colegio/cursos/[cursoId]/materias`; validación de duplicados `(cursoId, materiaId)`, cross-tenant y materia activa.
  - FR-008/009: endpoints REST entregados con Zod + rate limiting.
  - FR-010: página `/dashboard/colegio/materias` y sección `SeccionMateriasCurso` en ficha del curso.
  - FR-011: acciones `COLEGIO_MATERIA_CREADA`, `COLEGIO_MATERIA_ACTUALIZADA`, `COLEGIO_MATERIA_ESTADO_CAMBIADO`, `COLEGIO_CURSO_MATERIA_CREADA`, `COLEGIO_CURSO_MATERIA_ACTUALIZADA`, `COLEGIO_CURSO_MATERIA_ESTADO_CAMBIADO`.
- **Nota**: los oráculos de arquitectura se ajustaron a 60 modelos y 61 páginas; tokens de UI quedan dentro del piso.
