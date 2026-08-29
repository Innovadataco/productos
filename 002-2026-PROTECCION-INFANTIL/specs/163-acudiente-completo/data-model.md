# Data Model: SPEC-163 — Acudiente completo: identificadores + edición post-alta + conteo

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `AcudienteEstudiante` (actualizado)

Tabla hija de `Estudiante`. Mantiene los contactos humanos del acudiente. Se añade `estado` para permitir la baja lógica sin borrar datos.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `estudianteId` | String | FK → `Estudiante.id` | Tenant vía la relación |
| `orden` | Int | 1 \| 2 | Orden de preferencia/contacto |
| `nombre` | String | max 150 | |
| `relacion` | String | max 50 | Ej. madre, padre, tutor |
| `telefono` | String? | max 50 | Contacto legible (no alerta automática) |
| `email` | String? | max 255 | Contacto legible (no alerta automática) |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([estudianteId, orden, estado])` — permite tener un acudiente activo e inactivo con el mismo orden, pero nunca dos activos con el mismo orden.
- `@@index([estudianteId, estado])` — listados y conteos de acudientes activos.

**Validation Rules**:
- `orden` solo puede ser `1` o `2`.
- `nombre` y `relacion` obligatorios y con longitudes mínimas/máximas (validación Zod).
- Máximo 2 acudientes activos por estudiante; el repo valida el límite antes de crear.
- No se permite eliminar físicamente; la baja es cambio de `estado` a `inactivo`.

**State Transitions**:
```
activo → inactivo (baja lógica; inactiva en cascada sus IdentificadorAcudiente)
inactivo → activo (reactivación, si no excede el máximo de 2 activos)
```

---

### `IdentificadorAcudiente` (nuevo)

Identificadores tipados de un acudiente para matching de alertas (Fase C). Es colegio-scoped por `colegioId` denormalizado.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `acudienteId` | String | FK → `AcudienteEstudiante.id` | |
| `colegioId` | String | FK → `Colegio.id` | Denormalizado para validación de tenant y queries rápidas |
| `tipo` | String | max 50 | Ej. telefono, email, nick |
| `valor` | String | max 255 | Valor normalizado para matching |
| `plataformaId` | String? | FK → `Plataforma.id` | Opcional |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([acudienteId, tipo, valor, plataformaId])` — un mismo identificador por acudiente.
- `@@index([colegioId, estado])` — listados y conteos por colegio.
- `@@index([acudienteId, estado])` — identificadores de un acudiente.
- `@@index([valor])` — búsqueda cross-tenant para alertas (Fase C).

**Validation Rules**:
- `acudienteId` debe pertenecer a un estudiante del mismo `colegioId`.
- `plataformaId`, si se envía, debe existir en el catálogo global de plataformas.
- `valor` no vacío, normalizado (ej. teléfonos en E.164, nicks sin espacios extremos).
- `tipo` se infiere del valor si no se envía (misma lógica que `IdentificadorEstudiante`).
- No se permite eliminar físicamente; la baja es cambio de `estado` a `inactivo`.

**State Transitions**:
```
activo → inactivo (baja lógica del identificador)
inactivo → activo (reactivación)
```

---

## Unchanged Entities

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
@@unique([colegioId, nombre, grado, anioLectivo])
```

### `Estudiante`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto. Los acudientes siguen colgando de `Estudiante`.

### `IdentificadorEstudiante`

**NO se modifica**. Sigue siendo la fuente de alertas para estudiantes; la Fase C extenderá el matching a `IdentificadorAcudiente`.

### `AlertaColegio`

**NO se modifica en esta fase**. Hoy referencia `identificadorEstudianteId`. La Fase C generalizará la alerta para soportar estudiante/profesor/acudiente.

### `Profesor`

**NO se modifica**. La Fase B se encarga de sus identificadores.

### `Materia` / `CursoMateria`

**NO se modifican**. Quedan como quedaron en SPEC-162.

---

## Relationships

```text
Colegio 1──< Estudiante
Colegio 1──< AcudienteEstudiante (vía Estudiante)
Colegio 1──< IdentificadorAcudiente
Colegio 1──< Curso
Colegio 1──< Profesor
Colegio 1──< Materia
Colegio 1──< CursoMateria

Estudiante 1──< AcudienteEstudiante
Estudiante 1──< IdentificadorEstudiante

AcudienteEstudiante 1──< IdentificadorAcudiente

Plataforma 1──< IdentificadorAcudiente
Plataforma 1──< IdentificadorEstudiante
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. Añadir columna `estado` a la tabla `AcudienteEstudiante` con default `'activo'`.
2. Reemplazar/actualizar el unique constraint de `(estudianteId, orden)` por `(estudianteId, orden, estado)` para permitir la baja lógica sin bloquear la reasignación de orden.
3. Crear tabla `IdentificadorAcudiente` con FKs a `AcudienteEstudiante`, `Colegio` y `Plataforma`, unique `(acudienteId, tipo, valor, plataformaId)` e índices por `colegioId`, `acudienteId` y `valor`.
4. **No se toca** la tabla `Curso`: ni columnas nuevas, ni cambio de unique constraint, ni relación con `Estudiante`.
5. **No se toca** `Estudiante.cursoId`.
6. Backfill: todos los acudientes existientes quedan con `estado = 'activo'`. No se generan `IdentificadorAcudiente` automáticamente a partir de `telefono`/`email`.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. Los acudientes existentes continúan funcionando como contactos; los identificadores de acudiente se registran de forma opt-in por el rector.
