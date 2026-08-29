# Data Model: SPEC-164 — Identificadores de profesor + profesores en estadísticas

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `IdentificadorProfesor` (nuevo)

Identificador asociado a un profesor (teléfono, email, nick/usuario en plataforma). Baja lógica por `estado`; nunca se borra físicamente.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `profesorId` | String | FK → `Profesor.id` | Propiedad del profesor |
| `tipo` | String | max 50 | `TELEFONO`, `EMAIL`, `USUARIO`, `OTRO` o valor inferido |
| `valor` | String | max 255 | Normalizado antes de guardar |
| `plataformaId` | String? | FK → `Plataforma.id`, nullable | Plataforma asociada (opcional) |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([profesorId, valor, tipo, plataformaId])` — un mismo identificador no se repite para un profesor.
- `@@index([profesorId, estado])` — listados filtrados por profesor.
- `@@index([plataformaId])` — usos futuros de alertas por plataforma.

**Validation Rules**:
- `valor` no vacío, entre 1 y 255 caracteres después de normalizar.
- `tipo` inferido del valor si no se envía: teléfono E.164, email o `OTRO`.
- `plataformaId`, si se envía, debe existir en `Plataforma`.
- No se permite alta/edición si el profesor está `inactivo`.
- No se permite eliminación física; la baja es cambio de `estado` a `inactivo`.

**State Transitions**:
```
activo → inactivo (baja lógica)
inactivo → activo (reactivación)
```

---

## Unchanged Entities

### `Profesor`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
id, colegioId, nombre, apellidos, email?, telefono?, estado, createdAt, updatedAt
@@index([colegioId, estado])
```

Adquiere una relación `1:N` hacia `IdentificadorProfesor` sin cambiar sus campos.

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
@@unique([colegioId, nombre, grado, anioLectivo])
```

### `Estudiante`

**NO se modifica**. Los estudiantes siguen colgando directamente de `Curso` (`Estudiante.cursoId` intacto).

### `Plataforma`

**NO se modifica**. Se referencia opcionalmente desde `IdentificadorProfesor.plataformaId`.

### `AlertaColegio`

**NO se modifica en esta fase**. El matching sobre profesores se implementará en Fase C; la tabla `AlertaColegio` actual solo referencia `IdentificadorEstudiante`.

---

## Relationships

```text
Colegio 1──< Profesor
Colegio 1──< Curso
Colegio 1──< Estudiante
Colegio 1──< Materia
Colegio 1──< CursoMateria

Profesor 1──< IdentificadorProfesor
Profesor 1──< Curso (titular)
Profesor 1──< CursoMateria

Plataforma 1──< IdentificadorProfesor
Plataforma 1──< IdentificadorEstudiante
Plataforma 1──< IdentificadorReportado
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. Crear tabla `IdentificadorProfesor` con columnas `id`, `profesorId`, `tipo`, `valor`, `plataformaId`, `estado`, `createdAt`, `updatedAt`.
2. Añadir FKs a `Profesor(id)` y `Plataforma(id)`.
3. Añadir índice unique `(profesorId, valor, tipo, plataformaId)`.
4. Añadir índices `(profesorId, estado)` y `(plataformaId)`.
5. **No se toca** la tabla `Profesor`: ni columnas nuevas, ni cambio de índices, ni relación con `Curso`/`CursoMateria`.
6. **No se toca** la tabla `Curso` ni `Estudiante.cursoId`.
7. Backfill: no aplica; la tabla nace vacía.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. Los profesores, cursos y estudiantes existentes no se ven afectados; los identificadores de profesor se registran de forma opt-in.
