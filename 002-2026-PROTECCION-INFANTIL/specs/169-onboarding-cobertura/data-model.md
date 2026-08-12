# Data Model: SPEC-169 — Onboarding + cobertura + notificaciones in-app

**Date**: 2026-08-12
**Feature**: [spec.md](./spec.md)

---

## Active Entities

### `OnboardingColegio`

Fila única por colegio que guarda el estado del onboarding "Activa tu protección". El progreso de los pasos individuales se calcula dinámicamente a partir de los datos del colegio.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id`, **unique** | Aislamiento por colegio (DAL E-1) |
| `estado` | String | `@default("activo")` | `activo` \| `omitido` \| `completado` |
| `pasoActual` | String | `@default("bienvenida")` | Paso visible cuando está activo: `bienvenida` \| `cursos` \| `estudiantes` \| `profesores` \| `acudientes` \| `identificadores` \| `resumen` |
| `completadoEn` | DateTime? | nullable | Se llena la primera vez que pasa a `completado` |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@unique([colegioId])` — un solo onboarding por colegio.
- `@@index([estado])` — para backfill y reportes.

**Validation Rules**:
- `estado` solo puede ser `activo`, `omitido` o `completado`.
- `pasoActual` solo puede ser uno de los valores cerrados.
- No se permite eliminar físicamente; la baja lógica se representa con `estado = "completado"` u `omitido`.

**State Transitions**:
```
activo  → omitido     (el rector cierra el onboarding)
activo  → completado  (cobertura global > 0)
omitido → activo      (reactivación desde configuración)
completado → activo   (reactivación desde configuración)
```

---

### `NotificacionInApp`

Mensaje dirigido al usuario del colegio. Los estados se modelan con timestamps de lectura y archivo para evitar enum adicional.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `colegioId` | String | FK → `Colegio.id` | Aislamiento por colegio |
| `usuarioId` | String | FK → `Usuario.id` | Destinatario (rector del colegio) |
| `tipo` | String | | `ALERTA_NUEVA` \| `ALERTA_GESTIONADA` \| `ALERTA_ESCALADA` \| `SISTEMA` \| `ONBOARDING_RECORDATORIO` \| `COBERTURA_BAJA` |
| `titulo` | String | max 200 | Texto corto, sin PII |
| `mensaje` | String | max 1000 | Texto descriptivo, sin PII |
| `accionUrl` | String? | nullable | Ruta interna a la que lleva la notificación (ej. `/dashboard/colegio/alertas/[id]`) |
| `entidadId` | String? | nullable | Id de la entidad relacionada (alerta, reporte, etc.) |
| `entidadTipo` | String? | nullable | Tipo de entidad: `ALERTA_COLEGIO`, `SISTEMA`, etc. |
| `leidaEn` | DateTime? | nullable | NULL = no leída |
| `archivadaEn` | DateTime? | nullable | NULL = visible en bandeja |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Constraints**:
- `@@index([colegioId, usuarioId, archivadaEn, leidaEn, creadoEn])` — listado con filtros y orden.
- `@@index([colegioId, usuarioId, archivadaEn, creadoEn])` — listado general.
- `@@index([colegioId, entidadId, tipo])` — prevención de duplicados por evento.

**Validation Rules**:
- `titulo` y `mensaje` son obligatorios, con límites de longitud.
- `tipo` debe pertenecer al catálogo cerrado.
- `accionUrl`, si se envía, debe ser una ruta interna de la aplicación.
- Nunca se almacena el texto original del reporte, nombres de denunciante ni contenido sensible.
- La combinación `(colegioId, usuarioId, tipo, entidadId, DATE(creadoEn))` puede usarse para idempotencia cuando el evento lo permita.

**State Transitions**:
```
no_leida  → leida   (leidaEn se registra)
leida     → archivada (archivadaEn se registra; notificación sale de la bandeja)
```

---

## Unchanged Entities

### `Colegio`

**NO se modifica**. `OnboardingColegio` y `NotificacionInApp` se relacionan con él pero no alteran sus campos.

### `Curso`

**NO se modifica**. Ni columnas nuevas, ni cambio de unique constraint, ni relación con `Estudiante`.

### `Estudiante`

**NO se modifica**. `Estudiante.cursoId` se mantiene intacto.

### `Profesor`

**NO se modifica**. Se usa para contar profesores activos y, tras la fase B, sus identificadores.

### `AcudienteEstudiante`

**NO se modifica**. Se usa para contar acudientes activos y, tras la fase A, sus identificadores.

### `IdentificadorEstudiante`

**NO se modifica**. Se usa para calcular la cobertura de estudiantes.

### `AlertaColegio`

**NO se modifica**. Su creación y actualización de estado disparan la creación de `NotificacionInApp`.

### `Usuario`

**NO se modifica**. Se usa como destinatario de las notificaciones.

---

## Supporting Entities (assumed from Fases A/B)

Estas entidades no se crean en esta fase, pero el cálculo de cobertura las consume una vez existan.

### `IdentificadorAcudiente` (fase A)

- Relaciona un `AcudienteEstudiante` con uno o más identificadores (`valor`, `tipo`, `plataformaId`, `estado`).
- Solo identificadores con `estado = "activo"` cuentan para cobertura.

### `IdentificadorProfesor` (fase B)

- Relaciona un `Profesor` con uno o más identificadores (`valor`, `tipo`, `plataformaId`, `estado`).
- Solo identificadores con `estado = "activo"` cuentan para cobertura.

---

## Relationships

```text
Colegio 1──1 OnboardingColegio
Colegio 1──< NotificacionInApp
Colegio 1──< Curso
Colegio 1──< Estudiante
Colegio 1──< Profesor
Colegio 1──< AlertaColegio
Colegio 1──< AcudienteEstudiante (vía Estudiante)

Usuario 1──< NotificacionInApp

Curso 1──< Estudiante
Estudiante 1──< IdentificadorEstudiante
Estudiante 1──< AcudienteEstudiante
AcudienteEstudiante 1──< IdentificadorAcudiente (fase A)
Profesor 1──< IdentificadorProfesor (fase B)
```

---

## Migration Strategy (I-49 — aditiva y compatible)

1. Crear tabla `OnboardingColegio` con FK a `Colegio` y unique `colegioId`.
2. Crear tabla `NotificacionInApp` con FKs a `Colegio` y `Usuario`, e índices por `(colegioId, usuarioId, archivadaEn, creadoEn)`.
3. Ampliar el enum `AccionAudit` con los valores de onboarding y notificaciones (operación aditiva en PostgreSQL).
4. **No se tocan** las tablas `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante`, `IdentificadorEstudiante`, `AlertaColegio` ni `Usuario`.
5. Backfill de `OnboardingColegio`: para cada `Colegio` existente, insertar una fila con estado `completado` si el colegio ya tiene al menos un identificador activo; de lo contrario, `activo` con `pasoActual = "bienvenida"`.
6. No se crean notificaciones históricas; la bandeja empieza vacía para colegios existentes.

> **Nota sobre compatibilidad**: la migración es puramente aditiva. No hay `DROP`, `RENAME` ni cambios destructivos en tablas existentes.
