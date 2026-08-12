# Feature Specification: SPEC-162 — Materia configurable en cursos

**Feature Branch**: `work/002-pi-061`

**Created**: 2026-08-12

**Status**: PLANEADO

**Input**: Instructivo 002-PI-061. Fuentes vinculantes: [BRIEF-MODULO-COLEGIO](../../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-MODULO-COLEGIO.md) §3 (terminología) y §4.5 (Materia configurable). Patrones: SPEC-134 (tenant-first / DAL E-1), SPEC-137 (`withUnitOfWork`), SPEC-145 (soft delete), SPEC-146 (wizard unificado).

**Propuesta de respuesta a la sub-pregunta del brief**: el **grupo** (ej. "6A", "B", "8° B") se modela como un **atributo string de `Curso`**, no como entidad aparte. En esta fase `Curso` = `Materia` × `grupo` × `grado` × `añoLectivo`. Esto evita una migración destructiva sobre los cursos existentes y mantiene el modelo lo más simple posible; si en el futuro el CEO decide profesor multi-curso (§4.4 pendiente), el grupo ya está disponible como dimensión sin refactor adicional.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Rector configura el catálogo de materias de su colegio (Priority: P1)

Como rector (`SCHOOL_ADMIN`) quiero crear, listar, editar y desactivar las materias que mi colegio dicta, para que los cursos queden clasificados de forma uniforme.

**Why this priority**: es la pieza estructural sobre la que se construyen todos los demás cambios del módulo Colegio. Sin el catálogo, no hay forma de referenciar una materia desde un curso.

**Independent Test**: un rector puede listar las materias de su colegio, crear una nueva, editarla, inactivarla y reactivarla; otro rector no ve ni toca el catálogo ajeno.

**Acceptance Scenarios**:

1. **Given** un rector autenticado, **When** accede a `GET /api/colegio/materias`, **Then** recibe solo las materias activas de su colegio, ordenadas alfabéticamente.
2. **Given** un rector, **When** envía `POST /api/colegio/materias` con `nombre` único dentro de su colegio, **Then** se crea la materia en estado `activo` y se audita `COLEGIO_MATERIA_CREADA`.
3. **Given** un rector, **When** intenta crear dos materias con el mismo nombre en su colegio, **Then** recibe `409` con mensaje claro.
4. **Given** un rector, **When** envía `PATCH /api/colegio/materias/[id]` para renombrar una materia propia, **Then** se actualiza si no genera duplicado y se audita `COLEGIO_MATERIA_ACTUALIZADA`.
5. **Given** un rector, **When** envía `PATCH /api/colegio/materias/[id]/estado` con `inactivo`, **Then** la materia queda inactiva (soft delete) y ya no aparece en los selectores de curso; no se borra físicamente.
6. **Given** un rector de otro colegio, **When** intenta leer/crear/editar/inactivar una materia ajena, **Then** recibe `404` sin tocar nada (A/B).

---

### User Story 2 — Rector asigna materia al crear/editar un curso (Priority: P1)

Como rector quiero que cada curso esté vinculado a una materia de mi catálogo, de modo que "Física 6A" y "Física 6B" sean dos cursos distintos de la misma materia, y que el nombre libre actual pase a representar el **grupo**.

**Why this priority**: el brief §4.5 establece que lo que hoy se llama curso es realmente una materia; cambiar la semántica es necesario antes de las fases siguientes (profesor multi-curso, alertas extendidas, rediseño 3→2).

**Independent Test**: un rector puede crear un curso seleccionando una materia y escribiendo el grupo; el sistema valida que no exista otro curso con la misma combinación `(materia, grupo, grado, añoLectivo)` en el colegio.

**Acceptance Scenarios**:

1. **Given** una materia activa del colegio, **When** el rector crea un curso con `materiaId`, `nombre` (grupo), `grado` y `añoLectivo`, **Then** se persiste el curso vinculado a esa materia y se audita `COLEGIO_CURSO_CREADO`.
2. **Given** dos cursos del mismo grupo, grado y año pero con materias distintas, **When** el rector los crea, **Then** ambos se aceptan (la unicidad es por materia × grupo × grado × año).
3. **Given** un intento de crear un curso duplicado en `(materia, grupo, grado, añoLectivo)`, **When** se valida, **Then** recibe `409`.
4. **Given** un curso existente creado antes de esta feature, **When** el rector lo edita, **Then** puede asignarle una materia y un grupo; la edición sigue siendo posible aunque aún no tenga materia (compatibilidad hacia atrás).
5. **Given** un `materiaId` de otro colegio o inactivo, **When** se usa en un curso, **Then** la API devuelve `400`/`404` según corresponda.
6. **Given** el wizard unificado (SPEC-146), **When** se crea un curso nuevo, **Then** el paso 1 exige seleccionar una materia activa y un grupo; el flujo de estudiantes no cambia.

---

### User Story 3 — Los listados y fichas muestran la materia (Priority: P2)

Como rector quiero ver en los listados de cursos y en la ficha de cada curso la materia a la que pertenece, para no depender de convenciones de nombre libre.

**Why this priority**: mejora la usabilidad y cierra el ciclo de la nueva semántica, pero no bloquea las funcionalidades centrales (US1/US2).

**Independent Test**: en la tabla de cursos y en el escritorio de un curso se renderiza "Materia · Grupo (Grado)" en lugar de solo el nombre libre.

**Acceptance Scenarios**:

1. **Given** la lista de cursos, **When** se cargan, **Then** cada fila muestra el nombre de la materia y el grupo; los cursos sin materia muestran "Sin materia".
2. **Given** el escritorio de un curso, **When** se abre, **Then** el encabezado muestra la materia y el grupo.
3. **Given** el selector de curso en el wizard unificado, **When** se lista la oferta existente, **Then** se muestra materia + grupo.

---

### Edge Cases

- **Materia inactiva**: no se puede asignar a cursos nuevos; los cursos existentes con esa materia siguen funcionando (la inactivación es del catálogo, no de la relación histórica).
- **Cursos existentes sin materia**: quedan editables; la API acepta `materiaId` opcional en PATCH y obligatorio en POST nuevo.
- **Nombre de materia sanitizado**: se normaliza espacios y mayúsculas/minúsculas para la comparación de duplicados (no se permiten "Física" y " física ").
- **Grupo vacío**: se permite (un curso puede ser solo materia + grado + año), pero la combinación completa debe seguir siendo única por colegio.
- **Soft delete**: la materia inactiva se conserva; no se borra físicamente para mantener el histórico de cursos que la referencian.
- **Cross-tenant**: toda consulta de materia incluye `colegioId`; intentar acceder a una materia ajena devuelve 404.
- **Unicidad en cursos**: la constraint de BD pasa a ser `(colegioId, materiaId, nombre, grado, anioLectivo)`; la migración aditiva debe no romper datos existentes.
- **Seed inicial**: al crear un colegio se siembra un catálogo por defecto (Matemáticas, Física, Química, Biología, Ciencias Sociales, Filosofía, Religión, Lengua Castellana, Inglés, Arte, Educación Física, Tecnología). El rector puede modificarlo después.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir al `SCHOOL_ADMIN` gestionar un catálogo de `Materia` propio de su colegio (CRUD + cambio de estado).
- **FR-002**: El sistema DEBE crear automáticamente un catálogo inicial de materias al dar de alta un colegio.
- **FR-003**: El modelo `Curso` DEBE referenciar `Materia` mediante `materiaId` (nullable en la migración aditiva para no romper cursos existentes).
- **FR-004**: El campo `Curso.nombre` DEBE pasar a representar el **grupo** en la UI/validación, manteniendo la columna en BD para compatibilidad.
- **FR-005**: El sistema DEBE garantizar unicidad de curso por `(colegioId, materiaId, nombre, grado, anioLectivo)`.
- **FR-006**: El sistema DEBE validar que la materia asignada a un curso pertenezca al mismo colegio y esté activa.
- **FR-007**: El sistema DEBE exponer endpoints REST para materias bajo `/api/colegio/materias` (GET, POST, PATCH, PATCH estado).
- **FR-008**: El sistema DEBE actualizar los endpoints de curso para aceptar `materiaId` (POST/PATCH y wizard unificado).
- **FR-009**: El sistema DEBE actualizar la UI de cursos (lista, edición, alta, wizard) para mostrar y solicitar materia + grupo.
- **FR-010**: El sistema DEBE auditar las mutaciones sobre `Materia` y las ediciones de `Curso` que cambien la materia.

### Key Entities

- **Materia**: catálogo colegio-scoped. Atributos: `id`, `colegioId`, `nombre`, `estado` (activo/inactivo), `creadoEn`, `actualizadoEn`.
- **Curso** (modificado): añade `materiaId` (FK → `Materia`, nullable); `nombre` representa el grupo; relación con `Materia`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Un rector puede crear al menos 50 materias y listarlas en < 500 ms.
- **SC-002**: El 100% de las operaciones sobre materias respetan el aislamiento por `colegioId`.
- **SC-003**: Todos los cursos nuevos se crean obligatoriamente con una materia activa del mismo colegio.
- **SC-004**: Los cursos existentes sin materia siguen editables y no generan errores de lectura.
- **SC-005**: Cada mutación de materia y cada cambio de materia en un curso genera un `AuditLog` inmutable.
- **SC-006**: La migración de BD es aditiva: cero downtime, cero pérdida de datos, cursos existentes intactos.

---

## Assumptions

- El campo `Curso.nombre` actual se reinterpreta como grupo; no se renombra la columna en esta fase para mantener la compatibilidad con datos y queries existentes.
- El grupo no requiere entidad propia en esta fase; si el CEO decide profesor multi-curso (§4.4), el modelo ya soporta materia × grupo.
- `SCHOOL_ADMIN` es el único rol que administra materias; no se requiere módulo de permisos nuevo (se reusa `colegios_gestion`).
- No se requiere eliminación física de materias; la baja es soft delete por `estado`.
- El seed inicial de materias es una lista fija sugerida por el brief; el rector puede modificarla.

---

## Implementación

*Pendiente. Se documentará tras el cierre de la feature.*
