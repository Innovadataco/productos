# Data Model: SPEC-168 — Comité de Convivencia por colegio

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `RolUsuario` (enum extendido)

Añade el rol del Comité de Convivencia del colegio, separado del `COMITE_VALIDACION` de la plataforma.

```prisma
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
  OPERADOR
  COMITE_VALIDACION
  COMITE_CONVIVENCIA // NUEVO
}
```

---

### `Usuario` (modificado)

Cuenta compartida del comité. Se añade `comiteColegioId` como FK exclusiva al colegio, sin modificar `colegioId` (que sigue siendo único para el `SCHOOL_ADMIN`).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `email` | String | `@unique` | Unicidad global; compartida por todos los roles |
| `nombre` | String? | | |
| `passwordHash` | String | | |
| `rol` | RolUsuario | | `COMITE_CONVIVENCIA` para esta feature |
| `estado` | EstadoUsuario | `@default(activo)` | `activo` \| `inactivo` \| `bloqueado` |
| `debeCambiarPassword` | Boolean | `@default(false)` | |
| `colegioId` | String? | `@unique` | **NO se modifica**; sigue siendo del `SCHOOL_ADMIN` |
| `comiteColegioId` | String? | FK → `Colegio.id`, `@unique` | **NUEVO**; una sola cuenta de comité por colegio |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@unique` en `email` (existente).
- `@unique` en `colegioId` (existente, para `SCHOOL_ADMIN`).
- `@unique` en `comiteColegioId` (nuevo, garantiza una cuenta `COMITE_CONVIVENCIA` por colegio).
- Un `Usuario` con `comiteColegioId` debe tener `rol = COMITE_CONVIVENCIA` (validación de aplicación).

**Validation Rules**:
- No se permite crear un segundo usuario `COMITE_CONVIVENCIA` con el mismo `comiteColegioId`.
- No se permite usar un `email` que ya exista en otro usuario.
- El comité está vinculado a un único colegio; su `colegioId` lógico se obtiene de `comiteColegioId`.

**State Transitions**:
```
activo → inactivo (baja lógica de la cuenta)
inactivo → activo (reactivación)
```

---

### `IntegranteComite` (modificado)

Padrón documentado del comité. Se reusa para el Comité de Validación de la plataforma y para el Comité de Convivencia de cada colegio, diferenciados por el rol del `Usuario` referenciado en `comiteId`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `comiteId` | String | FK → `Usuario.id` | Puede ser `COMITE_VALIDACION` o `COMITE_CONVIVENCIA` |
| `nombres` | String | | |
| `apellidos` | String | | |
| `tipoIdentificacion` | TipoIdentificacionIntegrante | | |
| `numeroIdentificacion` | String | | Cifrado en reposo (AES-256-GCM) |
| `email` | String | | |
| `cargo` | String? | | **NUEVO**; cargo dentro del comité (p.ej. "Rector", "Psicólogo", "Estudiante") |
| `fechaInicio` | DateTime | `@default(now())` | |
| `fechaFin` | DateTime? | | Se llena al inactivar |
| `estado` | EstadoIntegranteComite | `@default(ACTIVO)` | `ACTIVO` \| `INACTIVO` |
| `creadoPorId` | String | FK → `Usuario.id` | Rector o admin que dio el alta |
| `modificadoPorId` | String? | FK → `Usuario.id` | |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@index([comiteId])`
- `@@index([estado])`
- `@@unique([comiteId, numeroIdentificacion])` (evita el mismo documento dos veces en el mismo comité)

**Validation Rules**:
- `comiteId` debe referir a un `Usuario` con `rol = COMITE_CONVIVENCIA` para esta feature (validación de aplicación).
- `numeroIdentificacion` se normaliza, valida y cifra antes de persistir.
- `cargo` es opcional para compatibilidad con integrantes históricos del `COMITE_VALIDACION`; obligatorio en el formulario del rector (Zod).
- No se permite eliminar físicamente; la baja es cambio de `estado` a `INACTIVO`.

**State Transitions**:
```
ACTIVO → INACTIVO (baja lógica)
INACTIVO → ACTIVO (reactivación)
```

---

### `SolicitudComite` (modificado)

Escalamiento de un caso del colegio hacia su Comité de Convivencia. Se reusa la tabla existente, añadiendo `colegioId` y `alertaColegioId` para acotar al colegio y evitar escalamientos duplicados.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `reporteId` | String | `@unique`, FK → `Reporte.id` | Reporte origen (único por solicitud) |
| `numero` | String | `@unique` | Número público de la solicitud |
| `estado` | String | `@default("PENDIENTE")` | `PENDIENTE` \| `RESUELTA` |
| `comiteId` | String? | FK → `Usuario.id` | Para comité de validación de la plataforma (legacy) |
| `operadorId` | String? | FK → `Usuario.id` | Para comité de validación de la plataforma (legacy) |
| `colegioId` | String? | FK → `Colegio.id` | **NUEVO**; acota al colegio |
| `alertaColegioId` | String? | FK → `AlertaColegio.id` | **NUEVO**; alerta que se escaló |
| `creadoPorId` | String? | FK → `Usuario.id` | **NUEVO**; rector que escaló |
| `motivo` | String | `@db.Text` | Motivo del escalamiento |
| `resolucion` | String? | `@db.Text` | Decisión del comité |
| `creadoEn` | DateTime | `@default(now())` | |
| `resueltoEn` | DateTime? | | |

**Constraints**:
- `@unique([reporteId])` (existente)
- `@unique([numero])` (existente)
- `@@unique([alertaColegioId])` (nuevo; una alerta no se escala dos veces)
- `@@index([colegioId, estado])` (nuevo; bandeja del comité por colegio)
- `@@index([colegioId, creadoEn])` (nuevo; listado del rector)
- `@@index([alertaColegioId])` (nuevo)
- `@@index([creadoPorId])` (nuevo)

**Validation Rules**:
- Si `colegioId` está presente, la solicitud pertenece al Comité de Convivencia de ese colegio.
- `alertaColegioId` debe apuntar a una `AlertaColegio` del mismo `colegioId`.
- `creadoPorId` debe ser un `SCHOOL_ADMIN` del mismo `colegioId`.
- No se permite escalar una alerta que ya tenga una solicitud.
- Estado: `PENDIENTE` → `RESUELTA` (no se reabre).

**State Transitions**:
```
PENDIENTE → RESUELTA (el comité documenta decisión)
```

---

### `Colegio` (modificado)

Relación inversa hacia la cuenta del comité de convivencia.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| ... | ... | ... | Resto sin cambios |
| `comiteConvivencia` | Usuario? | Relación inversa por `Usuario.comiteColegioId` | **NUEVO**; una cuenta opcional de comité |

No se añaden columnas a `Colegio`; la relación se define desde `Usuario.comiteColegioId`.

---

### `AccionAudit` (enum extendido)

Nuevas acciones específicas del comité de convivencia.

```prisma
enum AccionAudit {
  ... // existentes
  // SPEC-168: Comité de Convivencia por colegio
  COLEGIO_COMITE_CREADO
  COLEGIO_COMITE_PASSWORD_REGENERADA
  COLEGIO_COMITE_INTEGRANTE_CREADO
  COLEGIO_COMITE_INTEGRANTE_ACTUALIZADO
  COLEGIO_COMITE_INTEGRANTE_INACTIVADO
  COLEGIO_CASO_ESCALADO_A_COMITE
  COLEGIO_CASO_RESUELTO_POR_COMITE
}
```

---

## Unchanged Entities

### `Curso`

**NO se modifica**. Atributos, relaciones y unique constraint actuales se conservan.

### `Estudiante`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto.

### `AcudienteEstudiante`

**NO se modifica**. Solo se menciona como sujeto posible de alerta en fases futuras.

### `IdentificadorEstudiante`

**NO se modifica**. Sigue siendo la base del matching de alertas.

### `Profesor`

**NO se modifica**. Sujeto posible de alerta en fases futuras.

### `Reporte`

**NO se modifica**. El comité no altera el reporte; la resolución se guarda en `SolicitudComite.resolucion`.

### `ClasificacionIA`

**NO se modifica**. El comité de convivencia no corrige la clasificación.

### `AlertaColegio`

**NO se modifica en campos**. Su `colegioId` y su estado (`nueva` | `vista` | `gestionada`) se usan para el escalamiento y el cierre.

### `SeguimientoCaso` / `NotaSeguimiento`

**NO se modifican**. Se reusan para la bitácora del caso; el comité puede leer y agregar notas.

---

## Relationships

```text
Colegio 1──0..1 Usuario (comité)        vía Usuario.comiteColegioId
Colegio 1──1 Usuario (admin)            vía Usuario.colegioId (existente)
Colegio 1──< IntegranteComite           vía Usuario.comiteColegioId → Usuario.id → IntegranteComite.comiteId
Colegio 1──< SolicitudComite            vía SolicitudComite.colegioId
Colegio 1──< AlertaColegio              (existente)
Colegio 1──< SeguimientoCaso            (existente)

Usuario (COMITE_CONVIVENCIA) 1──< IntegranteComite
Usuario (COMITE_CONVIVENCIA) 1──< SolicitudComite  (comiteId, legacy no usado para convivencia)

AlertaColegio 1──0..1 SolicitudComite   vía SolicitudComite.alertaColegioId
AlertaColegio 1──1 SeguimientoCaso      (existente)
SeguimientoCaso 1──< NotaSeguimiento    (existente)
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. **Extender enum `RolUsuario`** con `COMITE_CONVIVENCIA`.
2. **Extender enum `AccionAudit`** con las acciones `COLEGIO_COMITE_*` y `COLEGIO_CASO_*`.
3. **Añadir columna `cargo`** a `IntegranteComite` (nullable o con default vacío para integrantes históricos).
4. **Añadir columnas a `SolicitudComite`**:
   - `colegioId` (nullable FK a `Colegio.id`)
   - `alertaColegioId` (nullable FK a `AlertaColegio.id`)
   - `creadoPorId` (nullable FK a `Usuario.id`)
5. **Crear índices en `SolicitudComite`**:
   - Unique `(alertaColegioId)`
   - `(colegioId, estado)`
   - `(colegioId, creadoEn)`
   - `(alertaColegioId)`
   - `(creadoPorId)`
6. **Añadir columna `comiteColegioId` a `Usuario`** (nullable FK a `Colegio.id`, unique).
7. **No se toca** `Usuario.colegioId` ni su `@unique`; no se toca `Curso` ni `Estudiante.cursoId`.
8. **Backfill**: no requiere datos obligatorios; las columnas nuevas son nullable y los colegios existentes no tienen comité de convivencia hasta que el rector lo cree.
9. **Seed de permisos**: añadir módulos `colegios_comite` y `colegios_comite_bandeja` y grants por defecto para `SCHOOL_ADMIN` y `COMITE_CONVIVENCIA`.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. Los comités de validación existentes (`COMITE_VALIDACION`) no se ven afectados; las solicitudes históricas de la plataforma conservan `colegioId = null`.
