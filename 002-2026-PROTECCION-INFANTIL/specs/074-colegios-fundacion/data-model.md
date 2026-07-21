# Data Model: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Date**: 2026-07-21
**Feature**: specs/074-colegios-fundacion/spec.md

---

## Active Entities

### `Colegio` (nuevo)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `nombre` | String | max 200 | Nombre de la institución |
| `paisId` | String | FK → `Pais.id` | Ubicación principal |
| `departamentoId` | String? | FK → `Departamento.id` | Opcional |
| `ciudadId` | String | FK → `Ciudad.id` | |
| `direccion` | String? | max 300 | Dirección textual |
| `representanteLegalNombre` | String | max 200 | |
| `representanteLegalIdentificacion` | String | max 50 | |
| `representanteLegalEmail` | String | max 255 | Email del representante legal (no login) |
| `representanteLegalTelefono` | String? | max 50 | |
| `inicioServicio` | DateTime | | Inicio del periodo de servicio |
| `finServicio` | DateTime? | | Fin del periodo; null = indefinido |
| `tipoPeriodo` | Enum | `TipoPeriodoServicio` | MENSUAL / SEMESTRAL / ANUAL |
| `estado` | String | default `"activo"` | `activo` \| `inactivo` |
| `tenantId` | String | FK → `Tenant.id`, `@unique` | Un tenant por colegio |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Validation Rules**:
- `finServicio` ≥ `inicioServicio` (si no es null).
- `paisId`/`ciudadId` requeridos.
- `departamentoId` opcional, pero si se envía debe pertenecer al mismo país.
- `estado` solo `activo` o `inactivo`.
- `tenantId` único: un colegio = un tenant.

**State Transitions**:
```
activo → inactivo (desactivación por admin)
inactivo → activo (reactivación por admin)
```

**Relationships**:
- `Colegio → Pais` (m:1)
- `Colegio → Departamento` (m:1, optional)
- `Colegio → Ciudad` (m:1)
- `Colegio → Tenant` (1:1)
- `Colegio → Usuario` (1:1, SCHOOL_ADMIN)

---

### `Usuario` (modificado, aditivo)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `colegioId` | String? | FK → `Colegio.id` | Nuevo; solo para SCHOOL_ADMIN |
| ... | ... | ... | Campos existentes sin cambios |

**Validation Rules**:
- Si `colegioId` no es null, `rol` DEBE ser `SCHOOL_ADMIN`.
- Solo un usuario `SCHOOL_ADMIN` por colegio (unique constraint parcial en PostgreSQL por `rol` y `colegioId`).
- `colegioId` y `tenantId` deben coincidir con el colegio vinculado.

---

### `Tenant` (reutilizado)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `nombre` | String | | Nombre del tenant/colegio |
| `estado` | String | default `"activo"` | |
| `creadoEn` | DateTime | `@default(now())` | |

**Relationship**:
- `Tenant → Colegio` (1:1)

---

### `AuditLog` (reutilizado)

Nuevos valores en `AccionAudit`:
- `COLEGIO_CREADO`
- `COLEGIO_ACTUALIZADO`
- `COLEGIO_DESACTIVADO`
- `COLEGIO_REACTIVADO`
- `COLEGIO_PASSWORD_REGENERADA`
- `COLEGIO_EMAIL_REENVIADO`

---

## Entity Relationships

```
Pais ||--o{ Colegio : "colegios"
Departamento ||--o{ Colegio : "colegios"
Ciudad ||--o{ Colegio : "colegios"
Tenant ||--|| Colegio : "colegio"
Colegio ||--|| Usuario : "admin (SCHOOL_ADMIN)"
Usuario }o--|| Tenant : "pertenece"
```

---

## Data Access

### Endpoints nuevos

- `GET /api/admin/colegios` — lista paginada de colegios (solo ADMIN).
- `POST /api/admin/colegios` — crea colegio + SCHOOL_ADMIN.
- `GET /api/admin/colegios/[id]` — detalle del colegio.
- `PATCH /api/admin/colegios/[id]` — editar colegio.
- `PATCH /api/admin/colegios/[id]/activar` — reactivar.
- `PATCH /api/admin/colegios/[id]/desactivar` — desactivar.
- `PATCH /api/admin/colegios/[id]/regenerar-password` — nueva contraseña temporal.
- `POST /api/admin/colegios/[id]/reenviar-email` — reenviar email de bienvenida.
- `GET /api/me/colegio` — datos del colegio del SCHOOL_ADMIN autenticado.

### Endpoints modificados

- `POST /api/auth/login` — verifica vigencia del colegio si el rol es SCHOOL_ADMIN.
- `POST /api/reportes` — rechaza SCHOOL_ADMIN.

### Endpoints sin cambios

- `GET /api/paises`, `GET /api/ciudades`, `GET /api/ciudades?paisId=...` — se usan en el formulario de colegio.

---

## Indexes

| Table | Fields | Reason |
|-------|--------|--------|
| `Colegio` | `paisId` | Búsqueda por país |
| `Colegio` | `departamentoId` | Búsqueda por departamento |
| `Colegio` | `ciudadId` | Búsqueda por ciudad |
| `Colegio` | `tenantId` | Unique + lookup por tenant |
| `Colegio` | `estado` | Filtrado activos/inactivos |
| `Usuario` | `colegioId` | Unique parcial (SCHOOL_ADMIN) + lookup |
| `Usuario` | `tenantId` | Multi-tenant |

---

## Migrations

### Migración aditiva: `add_colegio`

1. Crear enum `TipoPeriodoServicio` (`MENSUAL`, `SEMESTRAL`, `ANUAL`).
2. Crear tabla `colegios` con columnas e índices.
3. Agregar `colegioId` nullable a `usuarios` con FK a `colegios.id`.
4. Agregar valores `COLEGIO_*` al enum `AccionAudit`.
5. No modificar datos existentes; no eliminar columnas.

---

## Seed Data

No se requieren datos de seed para colegios en esta fase. Los colegios se crean exclusivamente por el admin desde el panel. El seed existente no se modifica.
