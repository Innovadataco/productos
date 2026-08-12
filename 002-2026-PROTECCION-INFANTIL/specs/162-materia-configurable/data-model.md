# Data Model: SPEC-162 — Materia configurable en cursos

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `Materia`

Catálogo colegio-scoped de materias. Baja lógica por `estado`; nunca se borra físicamente.

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

### `Curso` (cambios respecto al estado actual)

Se añade `materiaId` (nullable en la migración aditiva) y se reinterpreta `nombre` como el **grupo**.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | |
| `materiaId` | String? | FK → `Materia.id`, nullable | Nullable para compatibilidad con cursos existentes |
| `nombre` | String | max 150 | Ahora representa el **grupo** (ej. "6A", "B") |
| `grado` | String? | max 100 | |
| `anioLectivo` | String? | max 20 | |
| `estado` | String | `@default("activo")` | |
| `profesorTitularId` | String? | FK → `Profesor.id` | Sin cambio (SPEC-145) |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([colegioId, materiaId, nombre, grado, anioLectivo])` — un curso por combinación materia × grupo × grado × año.
- Se elimina la constraint anterior `@@unique([colegioId, nombre, grado, anioLectivo])` en la misma migración aditiva (Prisma la reemplaza).

**Validation Rules**:
- `materiaId` obligatorio para cursos **nuevos**.
- `materiaId` opcional en PATCH para permitir compatibilidad con cursos existentes.
- La materia debe pertenecer al mismo `colegioId` y estar `activa`.
- El grupo (`nombre`) puede estar vacío, pero si está presente debe tener ≤ 150 caracteres.

---

## Relationships

```text
Colegio 1──< Materia
Colegio 1──< Curso
Materia 1──< Curso
Profesor 1──< Curso (titular, opcional)
Curso 1──< Estudiante
```

## Migration Strategy (I-49 — aditiva y compatible)

1. Crear tabla `Materia` con índice unique `(colegioId, nombre)`.
2. Añadir columna `materiaId` a `Curso` como nullable.
3. Añadir FK `Curso.materiaId → Materia.id`.
4. Reemplazar unique constraint de `Curso` por `(colegioId, materiaId, nombre, grado, anioLectivo)`.
5. Backfill: por cada `Colegio` existente, crear una materia por defecto `"Otra"` (o `"General"`) en estado `activo` y asignarla a todos sus cursos existentes (deja `nombre` como grupo).
6. Seed inicial: al crear un nuevo colegio, insertar el catálogo por defecto de materias junto con el colegio (dentro de la misma transacción `withUnitOfWork`).

> **Nota sobre compatibilidad**: los cursos existentes quedan con `materiaId` apuntando a la materia por defecto; el rector puede editarlos posteriormente para asignar la materia real. No se renombra la columna `nombre` para evitar reescritura masiva de queries y componentes en esta fase.
