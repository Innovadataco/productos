# Data Model: SPEC-162 — Materia configurable en cursos

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `Materia`

Catálogo colegio-scoped de asignaturas. Baja lógica por `estado`; nunca se borra físicamente.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | Aislamiento por colegio (DAL E-1) |
| `nombre` | String | max 150 | Normalizado para comparación de duplicados |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([colegioId, nombre])` — un nombre de materia por colegio.

**Validation Rules**:
- `nombre` no vacío, entre 1 y 150 caracteres después de trim.
- Comparación de duplicados case-insensitive y colapsando espacios.
- No se permite eliminar físicamente; la baja es cambio de `estado` a `inactivo`.

**State Transitions**:
```
activo → inactivo (baja lógica)
inactivo → activo (reactivación)
```

---

### `CursoMateria` (nuevo)

Vínculo entre un curso (grupo) y una materia. Un curso puede tener muchas materias; una materia puede estar en muchos cursos. Opcionalmente indica quién la dicta.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | Denormalizado para validación de tenant y queries rápidas |
| `cursoId` | String | FK → `Curso.id` | |
| `materiaId` | String | FK → `Materia.id` | |
| `profesorId` | String? | FK → `Profesor.id`, nullable | Profesor que dicta la materia en ese curso |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([cursoId, materiaId])` — una sola asignación de materia por curso.
- `@@index([colegioId, estado])` — listados filtrados por colegio.
- `@@index([cursoId, estado])` — materias de un curso.
- `@@index([profesorId])` — cursos/materias de un profesor (futuro profesor multi-curso).

**Validation Rules**:
- `cursoId`, `materiaId` y `profesorId` (si se envía) deben pertenecer al mismo `colegioId`.
- `materiaId` debe estar activa al crear un vínculo.
- `profesorId` debe estar activo al crear un vínculo (si se envía).
- No se permite eliminar físicamente; la baja es cambio de `estado` a `inactivo`.

**State Transitions**:
```
activo → inactivo (baja lógica del vínculo)
inactivo → activo (reactivación)
```

---

## Unchanged Entities

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
@@unique([colegioId, nombre, grado, anioLectivo])
```

`Curso.nombre` sigue representando el grupo (ej. "6°A"). `Estudiante.cursoId` se mantiene intacto.

### `Estudiante`

**NO se modifica**. Los estudiantes siguen colgando directamente de `Curso`.

### `Profesor`

**NO se modifica**. `Profesor` se referencia opcionalmente desde `CursoMateria.profesorId`.

---

## Relationships

```text
Colegio 1──< Materia
Colegio 1──< Curso
Colegio 1──< CursoMateria
Colegio 1──< Profesor
Colegio 1──< Estudiante

Curso 1──< Estudiante
Curso 1──< CursoMateria

Materia 1──< CursoMateria
Profesor 1──< CursoMateria
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. Crear tabla `Materia` con índice unique `(colegioId, nombre)`.
2. Crear tabla `CursoMateria` con FKs a `Colegio`, `Curso`, `Materia` y `Profesor`, unique `(cursoId, materiaId)` e índices por `colegioId` y `cursoId`.
3. **No se toca** la tabla `Curso`: ni columnas nuevas, ni cambio de unique constraint, ni relación con `Estudiante`.
4. Backfill: por cada `Colegio` existente, crear el catálogo inicial de materias. No se crean vínculos `CursoMateria` automáticamente para cursos existentes (el rector los asignará manualmente).
5. Seed inicial: al crear un nuevo colegio, insertar el catálogo por defecto de materias dentro de la transacción de alta.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. Los cursos y estudiantes existentes no se ven afectados; la asignación de materias a cursos es opt-in por el rector.
