# Feature Specification: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

**Feature Branch**: `feature/001-scaffolding`

**Spec**: `075-colegios-cursos-alumnos`

**Created**: 2026-07-21

**Status**: CERRADA

**Input**: Fase 2 del módulo Colegios. El SCHOOL_ADMIN debe poder gestionar cursos, alumnos e identificadores de contacto de esos alumnos y allegados, todo dentro del aislamiento estricto de su propio colegio. No se conecta con alertas ni matching (Fase 4).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — SCHOOL_ADMIN gestiona cursos (Priority: P1)

El administrador institucional necesita crear, listar, editar y desactivar los cursos de su colegio (ej. 6A, 7B). Cada curso pertenece a un solo colegio y no puede ser visto ni gestionado por otro SCHOOL_ADMIN.

**Why this priority**: Los cursos son el agrupador básico para luego cargar alumnos e identificadores. Sin cursos no hay módulo de colegio operativo.

**Independent Test**: Un SCHOOL_ADMIN autenticado puede crear un curso, listar solo los cursos de su colegio, editar el nombre y desactivarlo. Otro SCHOOL_ADMIN de otro colegio no los ve.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado, **When** crea un curso con nombre y grado válidos, **Then** el sistema lo persiste con `colegioId` del usuario y devuelve 201.
2. **Given** un SCHOOL_ADMIN con cursos creados, **When** lista sus cursos, **Then** ve solo los de su colegio, ordenados por nombre.
3. **Given** un SCHOOL_ADMIN de otro colegio, **When** intenta listar o acceder a los cursos, **Then** no ve cursos ajenos y recibe 403/404 si intenta mutarlos.
4. **Given** un SCHOOL_ADMIN autenticado, **When** edita el nombre o grado de un curso propio, **Then** el sistema actualiza y registra auditoría.
5. **Given** un SCHOOL_ADMIN autenticado, **When** desactiva un curso propio, **Then** el curso queda inactivo y no se incluye en listados activos por defecto.

**Edge Cases**:
- No permitir dos cursos con el mismo nombre dentro del mismo colegio.
- No permitir curso con nombre vacío o menor a 2 caracteres.
- No permitir editar un curso de otro colegio (404).
- No permitir desactivar un curso que ya está inactivo (409).

---

### User Story 2 — SCHOOL_ADMIN gestiona alumnos dentro de un curso (Priority: P1)

El administrador institucional necesita dar de alta alumnos dentro de un curso, con datos mínimos y sin exceso de PII. Solo gestiona alumnos de su propio colegio.

**Why this priority**: El alumno es la unidad que vincula los identificadores. La Fase 2 necesita al menos nombre + curso para poder luego agregar identificadores.

**Independent Test**: Un SCHOOL_ADMIN puede crear un alumno en un curso propio, listar los alumnos de un curso, editar el nombre y desactivarlo. Otro SCHOOL_ADMIN no puede acceder.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN autenticado con un curso propio, **When** crea un alumno con nombre válido, **Then** el sistema lo persiste vinculado a ese curso y colegio.
2. **Given** un SCHOOL_ADMIN, **When** lista alumnos de un curso propio, **Then** ve solo los alumnos activos de ese curso y su colegio.
3. **Given** un SCHOOL_ADMIN, **When** intenta crear un alumno en un curso de otro colegio, **Then** recibe 404.
4. **Given** un SCHOOL_ADMIN, **When** edita el nombre de un alumno propio, **Then** el sistema actualiza y registra auditoría.
5. **Given** un SCHOOL_ADMIN, **When** desactiva un alumno propio, **Then** queda inactivo y no aparece en listados activos.

**Edge Cases**:
- No permitir alumno sin nombre.
- No permitir crear alumno en curso inexistente o de otro colegio.
- No permitir duplicados de nombre exacto dentro del mismo curso.

---

### User Story 3 — SCHOOL_ADMIN gestiona identificadores de alumnos y allegados (Priority: P1)

El administrador institucional necesita registrar uno o más identificadores por alumno (teléfono, email, nick, usuario de red social) con una etiqueta de relación (`alumno`, `madre`, `padre`, `primo`, `tutor`, `otro`). Estos identificadores serán usados en Fase 4 para alertas ciegas, pero en Fase 2 solo se administran.

**Why this priority**: Los identificadores son el input para el matching futuro. Sin ellos no hay alertas ni consulta institucional.

**Independent Test**: Un SCHOOL_ADMIN puede agregar, listar, editar y desactivar identificadores de un alumno propio. Reutiliza el patrón de ContactoConfianza/IdentificadorContacto.

**Acceptance Scenarios**:

1. **Given** un SCHOOL_ADMIN con un alumno propio, **When** agrega un identificador (teléfono + relación alumno), **Then** el sistema lo persiste y valida unicidad por alumno+valor+tipo.
2. **Given** un SCHOOL_ADMIN con identificadores creados, **When** lista los identificadores de un alumno propio, **Then** ve solo los activos de ese alumno.
3. **Given** un SCHOOL_ADMIN, **When** intenta agregar un identificador a un alumno de otro colegio, **Then** recibe 404.
4. **Given** un SCHOOL_ADMIN, **When** edita la etiqueta de relación o el valor de un identificador propio, **Then** el sistema actualiza y valida.
5. **Given** un SCHOOL_ADMIN, **When** desactiva un identificador propio, **Then** queda inactivo y no aparece en listados activos.

**Edge Cases**:
- No permitir identificador vacío.
- No permitir identificador duplicado (mismo valor + tipo + plataforma) para el mismo alumno.
- Validar plataforma si se selecciona (debe existir en la tabla Plataforma).
- Etiqueta de relación restringida a valores canónicos.

---

## Edge Cases (generales)

- Un SCHOOL_ADMIN con colegio vencido o inactivo no puede gestionar cursos/alumnos/identificadores (403).
- Un ADMIN puede ver todos los colegios pero no gestiona cursos/alumnos (Fase 2 es exclusiva del SCHOOL_ADMIN).
- Un OPERADOR/COMITE/PARENT no tienen acceso a estos endpoints (403).
- El borrado es lógico (`estado` = `activo`/`inactivo`); nunca físico.
- Los identificadores se almacenan en minúsculas y sin espacios extremos para normalizar matching futuro.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al rol SCHOOL_ADMIN crear, listar, editar y desactivar cursos de su propio colegio.
- **FR-002**: El sistema DEBE aislar estrictamente los cursos por `colegioId`; un SCHOOL_ADMIN nunca verá ni mutará cursos de otro colegio.
- **FR-003**: El sistema DEBE permitir al rol SCHOOL_ADMIN crear, listar, editar y desactivar alumnos dentro de los cursos de su colegio.
- **FR-004**: El sistema DEBE validar que el alumno pertenezca a un curso del mismo colegio del SCHOOL_ADMIN autenticado.
- **FR-005**: El sistema DEBE permitir al rol SCHOOL_ADMIN registrar múltiples identificadores por alumno, con tipo, valor, plataforma opcional y etiqueta de relación.
- **FR-006**: El sistema DEBE reutilizar el patrón de normalización de identificadores del Círculo de Confianza (minúsculas, trim) para compatibilidad futura con matching.
- **FR-007**: El sistema DEBE validar que la etiqueta de relación sea uno de los valores canónicos: `alumno`, `madre`, `padre`, `primo`, `tutor`, `otro`.
- **FR-008**: El sistema DEBE registrar una traza de auditoría (`COLEGIO_*`) para toda mutación de curso, alumno o identificador.
- **FR-009**: El sistema DEBE rechazar con 403 cualquier intento de ADMIN/OPERADOR/COMITE/PARENT de gestionar cursos/alumnos/identificadores.
- **FR-010**: El sistema DEBE aplicar el tema visual verde (`.theme-colegio`) en todas las nuevas vistas del módulo colegio.
- **FR-011**: El sistema NO DEBE conectar identificadores con el motor de matching ni alertas en esta fase (reservado para Fase 4).
- **FR-012**: El sistema NO DEBE almacenar datos excesivos de PII del alumno; únicamente nombre y vinculación al curso/colegio.

### Key Entities

- **Curso**: `id`, `colegioId`, `nombre`, `grado`, `anioLectivo`, `estado`, `createdAt`, `updatedAt`.
- **Alumno**: `id`, `cursoId`, `colegioId`, `nombre`, `estado`, `createdAt`, `updatedAt`.
- **IdentificadorAlumno**: `id`, `alumnoId`, `tipo`, `valor`, `plataformaId`, `etiquetaRelacion`, `estado`, `createdAt`, `updatedAt`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las operaciones de ABM de cursos/alumnos/identificadores por un SCHOOL_ADMIN quedan dentro de su colegio; tests de aislamiento pasan.
- **SC-002**: Tiempo de respuesta de listado de cursos y alumnos menor a 500 ms para menos de 1000 registros.
- **SC-003**: Todos los endpoints de Fase 2 tienen tests de integración (≥90% de cobertura de endpoints).
- **SC-004**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npx vitest run` pasan sin errores.
- **SC-005**: Deploy limpio con `./scripts/dev-restart.sh` y healthcheck ok.

---

## Assumptions

- La Fase 1 (spec 074) está cerrada y el modelo `Colegio` + `Usuario.colegioId` existe.
- El rol `SCHOOL_ADMIN` ya está aislado de admin/operador/comité/reportes.
- La tabla `Plataforma` existe y se reutiliza para `plataformaId`.
- El sistema de auditoría con `AuditLog` y acciones `COLEGIO_*` existe.
- Para la Fase 4 se conectarán los identificadores con el motor de matching; en Fase 2 solo se adminstran.
- El tema verde `.theme-colegio` de la Fase 1 se aplica envolviendo layouts con esa clase.

---

## Implementación

- **Modelo y migración**: Se crearon los modelos `Curso`, `Alumno` e `IdentificadorAlumno`, el enum `EtiquetaRelacionAlumno` y las acciones de auditoría `COLEGIO_*` en `prisma/schema.prisma`. Se generó la migración aditiva `prisma/migrations/20260721060000_add_colegio_cursos_alumnos/migration.sql` y se aplicó a las bases de datos `proteccion_infantil` y `proteccion_infantil_test`.
- **Schemas y helpers**: Se agregaron los esquemas zod en `src/lib/schemas/index.ts` (`curso*`, `alumno*`, `identificadorAlumno*`, `estadoActivoSchema`). Se crearon `src/lib/colegio/permisos.ts` y `src/lib/colegio/normalizacion.ts`.
- **Endpoints**: Se implementaron todos los endpoints de `/api/colegio/*` con `verifyAuth("SCHOOL_ADMIN")`, `verificarVigenciaColegio`, `checkRateLimit`, validación con zod, aislamiento por `colegioId` y trazas de `AuditLog`.
- **UI**: Se crearon las vistas del módulo colegio (`/dashboard/colegio/cursos`, `/dashboard/colegio/cursos/nuevo`, `/dashboard/colegio/cursos/[id]`, `/dashboard/colegio/alumnos/[id]`, navegación `ColegioNav` y paneles de placeholder para Alertas y Estadísticas). Todas envueltas en `.theme-colegio` vía el layout existente.
- **Tests**: Se agregaron 32 tests nuevos para cursos, alumnos, identificadores y helpers de permisos. La suite completa pasa con 643 tests verdes.
- **Validación**: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `./scripts/dev-restart.sh` completaron exitosamente. Se ejecutó un smoke test del quickstart contra la app corriendo en `:5005`.
- **Deploy**: `./scripts/dev-restart.sh` levantó un worker, healthcheck ok.

---

## Status

**CERRADA**
