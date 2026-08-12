# Data Model: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote, SLA

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `AlertaColegio` (modificado aditivamente)

Entidad principal de la bandeja. Se añaden columnas para prioridad, SLA y asignación; se extienden los estados válidos. No se tocan relaciones existentes.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | Aislamiento por colegio (DAL E-1) |
| `reporteId` | String | FK → `Reporte.id` | |
| `identificadorEstudianteId` | String | FK → `IdentificadorEstudiante.id` | Relación existente; en Fase C se extiende a profesor/acudiente |
| `estado` | String | `@default("nueva")` | `nueva` \| `vista` \| `gestionada` \| `escalada` \| `cerrada` |
| `prioridad` | String | `@default("baja")` | `alta` \| `media` \| `baja` |
| `vencimientoSla` | DateTime | | Calculado al crear/recalcular según prioridad |
| `asignadoAId` | String? | FK → `Usuario.id` | Responsable del seguimiento (nullable) |
| `patronInstitucionalId` | String? | FK → `PatronInstitucional.id` | Campo existente (SPEC-142) |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([colegioId, reporteId, identificadorEstudianteId])` — existe; evita duplicados.
- `@@index([colegioId, estado])` — existente; listados por estado.
- `@@index([colegioId, prioridad, vencimientoSla])` — **nuevo**; orden de la bandeja.
- `@@index([colegioId, asignadoAId])` — **nuevo**; filtros/asignaciones.
- `@@index([reporteId])` — existente.

**Validation Rules**:
- `estado` debe ser uno de los valores cerrados; Zod rechaza cualquier otro.
- `prioridad` debe ser `alta`, `media` o `baja`.
- `vencimientoSla` debe ser posterior a `creadoEn`.
- `asignadoAId`, si se envía, debe corresponder a un `Usuario` del mismo `colegioId` o con rol operativo/comité autorizado para el colegio.
- No se permite eliminar físicamente alertas; los estados `escalada` y `cerrada` son terminales para efectos de SLA.

**State Transitions**:
```
nueva  → vista
vista  → gestionada
vista  → escalada
gestionada → escalada
gestionada → cerrada
escalada   → cerrada
escalada   → gestionada (reapertura controlada)
```
No se permite volver a `nueva`. Cualquier transición inválida devuelve 409.

**Cálculo de prioridad y SLA**:
- Se calcula al crear la alerta y al recalcular (cambio de clasificación o detección de `EventoMatch`).
- Reglas iniciales (configurables por `ParametroSistema`):
  - `alta`: categoría en `{SOLICITUD_ENCUENTRO, COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA, DOXING, EXTORSION}` **O** `posibleAgresorPar = true` **O** `EventoMatch.interCiudad = true` **O** `EventoMatch.conteoAcumulado >= 3`.
  - `media`: categoría en `{CONTACTO_INSISTENTE, SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS, SUPLANTACION_IDENTIDAD, CONTENIDO_GENERADO_IA}` y confianza ≥ 0.7, sin condiciones de `alta`.
  - `baja`: el resto.
- SLA base por prioridad (fallback): `alta` = 24 h, `media` = 48 h, `baja` = 72 h desde `creadoEn`.

---

### Entidades de soporte (sin cambios, solo lectura/escritura controlada)

#### `SolicitudComite`

Reusada para registrar el escalamiento de una alerta al comité de validación de la plataforma.

| Field | Uso en esta feature |
|-------|---------------------|
| `id` | Identificador de la solicitud |
| `reporteId` | `@unique`; cada reporte se escala una sola vez |
| `estado` | `PENDIENTE` al crear |
| `motivo` | Texto sugerido cuando el contexto es `EventoMatch` |
| `comiteId` | Asignado por el sistema o null hasta asignación |

#### `SeguimientoCaso` / `NotaSeguimiento`

Reusadas para la bitácora cuando el rector gestiona una alerta (SPEC-159).

#### `EventoMatch`

Leída por `reporteId` para mostrar contexto de reincidencia (SPEC-139).

---

## Unchanged Entities

### `Colegio`

No se modifica. Se usa `colegioId` como tenant en todas las operaciones.

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan:

```text
@@unique([colegioId, nombre, grado, anioLectivo])
```

Los filtros por curso usan el `cursoId` del estudiante vinculado a la alerta (o los cursos del profesor vía `CursoMateria` en Fase C).

### `Estudiante`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto.

### `Profesor`

**NO se modifica**. Se usa solo para filtrar por sujeto y, en Fase C, para alertas sobre identificadores de profesor.

### `AcudienteEstudiante`

**NO se modifica**. Se usa solo para filtrar por sujeto y, en Fase C, para alertas sobre identificadores de acudiente.

### `IdentificadorEstudiante`

**NO se modifica**. Relación existente desde `AlertaColegio`; en Fase C se extiende el matching a profesor/acudiente.

### `Reporte`

**NO se modificado**. Se lee para estado, clasificación y `EventoMatch`.

### `ClasificacionIA`

**NO se modifica**. Se lee `categoria`, `confianza` y `posibleAgresorPar` para calcular prioridad.

### `Usuario`

**NO se modifica**. Es destino de `AlertaColegio.asignadoAId`.

---

## Relationships

```text
Colegio 1──< AlertaColegio
Colegio 1──< Curso
Colegio 1──< Estudiante
Colegio 1──< Profesor

AlertaColegio N──1 Reporte
AlertaColegio N──1 IdentificadorEstudiante
AlertaColegio N──? Usuario (asignadoAId)
AlertaColegio 1──? SeguimientoCaso

Reporte 1──? ClasificacionIA
Reporte 1──? EventoMatch

Estudiante N──1 Curso
Estudiante 1──< IdentificadorEstudiante
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. Añadir columnas a `AlertaColegio`:
   - `prioridad` (`TEXT`, default `'baja'`).
   - `vencimientoSla` (`TIMESTAMP(3)`, nullable inicialmente; se backfill con `creadoEn + intervalo según prioridad`).
   - `asignadoAId` (`TEXT`, nullable).
2. Añadir índices:
   - `"AlertaColegio_colegioId_prioridad_vencimientoSla_idx"`.
   - `"AlertaColegio_colegioId_asignadoAId_idx"`.
3. **No se toca** `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante`, `IdentificadorEstudiante`, `Reporte`, `ClasificacionIA`, `EventoMatch` ni `SolicitudComite`.
4. **Backfill**:
   - Para alertas existentes, calcular `prioridad` y `vencimientoSla` según la clasificación del reporte vinculado y `EventoMatch` existente.
   - Las alertas sin clasificación quedan `baja` con SLA 72 h.
   - `asignadoAId` queda `NULL`.
5. **Enum / validaciones**:
   - `AccionAudit` recibe nuevos valores como migración aditiva del enum de Prisma.
   - El campo `estado` sigue siendo `String`; la validación Zod y TypeScript garantizan los cinco valores.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. Los endpoints y queries existentes siguen funcionando; las alertas históricas adquieren prioridad/SLA con el backfill.
