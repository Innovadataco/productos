# Data Model: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `AlertaColegio` (modificada)

Entidad central de la alerta. Se extiende para soportar tres tipos de sujeto. Una alerta apunta a exactamente UN sujeto.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | Tenant obligatorio |
| `reporteId` | String | FK → `Reporte.id` | |
| `identificadorEstudianteId` | String? | FK → `IdentificadorEstudiante.id` | **Pasa a opcional** |
| `identificadorProfesorId` | String? | FK → `IdentificadorProfesor.id` | NUEVO |
| `identificadorAcudienteId` | String? | FK → `IdentificadorAcudiente.id` | NUEVO |
| `tipoSujeto` | String / enum | `@default("ESTUDIANTE")` | `ESTUDIANTE` \| `PROFESOR` \| `ACUDIENTE` |
| `estado` | String | `@default("nueva")` | `nueva` \| `vista` \| `gestionada` |
| `patronInstitucionalId` | String? | FK → `PatronInstitucional.id` | Idempotencia de agregado (SPEC-142) |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([colegioId, reporteId, identificadorEstudianteId])` — dedupe para sujetos estudiante.
- `@@unique([colegioId, reporteId, identificadorProfesorId])` — dedupe para sujetos profesor.
- `@@unique([colegioId, reporteId, identificadorAcudienteId])` — dedupe para sujetos acudiente.
- `@@index([colegioId, estado])` — listados filtrados por colegio.
- `@@index([reporteId])` — búsqueda por reporte.
- `@@index([tipoSujeto])` — filtro por tipo de sujeto.

**Validation Rules**:
- Exactamente una de las tres FKs debe estar poblada y debe coincidir con `tipoSujeto`.
- `identificadorEstudianteId` es obligatorio solo cuando `tipoSujeto = ESTUDIANTE`.
- `identificadorProfesorId` es obligatorio solo cuando `tipoSujeto = PROFESOR`.
- `identificadorAcudienteId` es obligatorio solo cuando `tipoSujeto = ACUDIENTE`.
- No se permite eliminación física de alertas; el cierre es cambio de `estado`.

**State Transitions**:
```
nueva → vista → gestionada
```

**Backfill**: alertas históricas (`tipoSujeto` ausente) se migran a `ESTUDIANTE` y conservan `identificadorEstudianteId`.

---

### `IdentificadorProfesor` (prerrequisito Fase B)

Identificador asociado a un profesor del colegio. Patrón `IdentificadorEstudiante`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `profesorId` | String | FK → `Profesor.id` | |
| `tipo` | String | | Ej. `TELEFONO`, `NICK`, `EMAIL` |
| `valor` | String | | Normalizado para búsqueda |
| `plataformaId` | String? | FK → `Plataforma.id` | Opcional |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([profesorId, valor, tipo, plataformaId])` — sin duplicados por profesor.
- `@@index([profesorId, estado])` — listados activos.
- `@@index([valor])` — búsqueda cross-tenant por valor.

---

### `IdentificadorAcudiente` (prerrequisito Fase A)

Identificador asociado a un acudiente de un estudiante. Patrón `IdentificadorEstudiante`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `acudienteId` | String | FK → `AcudienteEstudiante.id` | |
| `tipo` | String | | Ej. `TELEFONO`, `NICK`, `EMAIL` |
| `valor` | String | | Normalizado para búsqueda |
| `plataformaId` | String? | FK → `Plataforma.id` | Opcional |
| `estado` | String | `@default("activo")` | `activo` \| `inactivo` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([acudienteId, valor, tipo, plataformaId])` — sin duplicados por acudiente.
- `@@index([acudienteId, estado])` — listados activos.
- `@@index([valor])` — búsqueda cross-tenant por valor.

---

## Unchanged Entities

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
@@unique([colegioId, nombre, grado, anioLectivo])
```

### `Estudiante`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto.

### `Profesor`

**NO se modifica** en esta fase. La relación `IdentificadorProfesor` se creó en Fase B.

### `AcudienteEstudiante`

**NO se modifica** en esta fase. La relación `IdentificadorAcudiente` se creó en Fase A.

### `SeguimientoCaso`

**NO se modifica**. Sigue vinculado 1:1 con `AlertaColegio.id`.

### `PatronInstitucional`

**NO se modifica**. Sigue siendo el agregado institucional sin PII; las alertas de cualquier tipo aportan al patrón según SPEC-142.

---

## Relationships

```text
Colegio 1──< AlertaColegio
Reporte 1──< AlertaColegio

IdentificadorEstudiante 1──< AlertaColegio
IdentificadorProfesor   1──< AlertaColegio
IdentificadorAcudiente  1──< AlertaColegio

Profesor 1──< IdentificadorProfesor
AcudienteEstudiante 1──< IdentificadorAcudiente
Plataforma 1──< IdentificadorProfesor
Plataforma 1──< IdentificadorAcudiente

PatronInstitucional 1──< AlertaColegio
AlertaColegio 1──1 SeguimientoCaso
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. **ALTER COLUMN** `AlertaColegio.identificadorEstudianteId` a nullable.
2. **ADD COLUMN** `AlertaColegio.tipoSujeto` (`String` o enum) con default `'ESTUDIANTE'`.
3. **ADD COLUMN** `AlertaColegio.identificadorProfesorId` (String, nullable).
4. **ADD COLUMN** `AlertaColegio.identificadorAcudienteId` (String, nullable).
5. **ADD FOREIGN KEYS** a `IdentificadorProfesor` e `IdentificadorAcudiente`.
6. **ADD UNIQUE CONSTRAINTS** por tipo de sujeto:
   - `(colegioId, reporteId, identificadorEstudianteId)`
   - `(colegioId, reporteId, identificadorProfesorId)`
   - `(colegioId, reporteId, identificadorAcudienteId)`
7. **Backfill**: actualizar `tipoSujeto = 'ESTUDIANTE'` en todas las alertas históricas.
8. **No se toca** `Curso` ni `Estudiante`.

> **Nota sobre compatibilidad**: la migración es aditiva en el sentido de que no elimina datos ni tablas. El único cambio estructural en una tabla existente es hacer nullable una FK y añadir columnas/constraints. Los datos históricos se preservan y se etiquetan vía backfill.
