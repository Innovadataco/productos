# Data Model: Autenticación Multi-Rol y Parámetros de Configuración

**Date**: 2026-07-11
**Feature**: specs/001-multi-role-auth-config/spec.md

---

## Active Entities (Fase Fundación)

### `Usuario`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `email` | String | `@unique`, max 255 | Normalizado a minúsculas |
| `nombre` | String | optional, max 100 | |
| `passwordHash` | String | min 60 (bcrypt) | |
| `rol` | Enum | `RolUsuario` | ADMIN \| SCHOOL_ADMIN \| PARENT |
| `estado` | Enum | `EstadoUsuario` | activo \| inactivo \| bloqueado |
| `intentosFallidos` | Int | `@default(0)` | Contador de login fallidos |
| `bloqueadoHasta` | DateTime | optional | |
| `ultimaSesion` | DateTime | optional | |
| `tenantId` | String | FK → `Tenant.id`, optional | Null para usuarios de plataforma (ADMIN) |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |

**Validation Rules**:
- Email: formato RFC 5322, único
- Password (input, not stored): min 8 chars, at least 1 letter and 1 number. No symbols required.
- No eliminar si tiene registros de auditoría (soft delete → estado = inactivo)

**State Transitions**:
```
activo → bloqueado (5 intentos fallidos)
bloqueado → activo (pasado el tiempo de bloqueo + login exitoso)
activo → inactivo (soft delete por admin)
inactivo → activo (reactivación por admin)
```

---

### `ParametroSistema`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `clave` | String | `@unique`, max 100 | Notación `categoria.subclave` |
| `valor` | String | max 4000 | Serializado según tipo |
| `tipo` | Enum | `TipoParametro` | STRING \| INTEGER \| FLOAT \| BOOLEAN \| JSON \| STRING_ARRAY |
| `categoria` | Enum | `CategoriaParametro` | VISIBILITY \| SECURITY \| LEGAL \| EMAIL \| SYSTEM |
| `esPublico` | Boolean | `@default(false)` | Lectura sin autenticación |
| `esSecreto` | Boolean | `@default(false)` | Cifrado en reposo |
| `descripcion` | String | optional, max 500 | |
| `reglasValidacion` | String | optional, max 1000 | JSON con reglas |
| `creadoEn` | DateTime | `@default(now())` | |
| `actualizadoEn` | DateTime | `@updatedAt` | |
| `actualizadoPorId` | String | FK → `Usuario.id`, optional | |

**Validation Rules**:
- `esSecreto = true` ⇒ `esPublico = false` (regla de negocio)
- INTEGER/FLOAT: validar min/max si `reglasValidacion` presente
- STRING: validar minLength/maxLength/pattern
- JSON: validar que sea JSON parseable
- STRING_ARRAY: validar que sea array de strings

---

### `AuditLog`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `accion` | Enum | `AccionAudit` | LOGIN \| LOGOUT \| PARAM_UPDATE \| USER_CREATE \| ... |
| `tipoRecurso` | String | max 50 | "parametro", "usuario", etc. |
| `recursoId` | String | optional | ID del recurso afectado |
| `usuarioId` | String | FK → `Usuario.id`, optional | Null para acciones anónimas |
| `valorAnterior` | String | optional, max 4000 | Para cambios de parámetros |
| `valorNuevo` | String | optional, max 4000 | |
| `ipAddress` | String | max 45 | IPv4/IPv6 |
| `userAgent` | String | max 500 | |
| `metadatos` | Json | optional | Datos adicionales flexibles |
| `creadoEn` | DateTime | `@default(now())` | |

**Invariants**:
- No se puede modificar ni eliminar (solo append)
- Retención mínima: 5 años

---

### `CodigoVerificacion`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | `@id @default(cuid())` | |
| `email` | String | max 255 | Email destinatario, no único (múltiples códigos por email) |
| `codigoHash` | String | min 60 | bcrypt del código de 6 dígitos |
| `expiraEn` | DateTime | | 15 minutos desde creación |
| `intentosFallidos` | Int | `@default(0)` | Máximo 5 antes de invalidar |
| `usado` | Boolean | `@default(false)` | true tras verificación exitosa |
| `creadoEn` | DateTime | `@default(now())` | |

**Validation Rules**:
- `expiraEn` = `creadoEn + 15 minutos`
- `intentosFallidos` ≤ 5
- Un código usado (`usado = true`) no puede reutilizarse
- Máximo 3 códigos activos (no usados, no expirados) por email en 1 hora

**Lifecycle**:
```
activo → usado (verificación exitosa)
activo → inválido (expirado o 5 intentos fallidos)
```

---

## Base Entities (Vacías, para fases futuras)

### `Tenant` (Colegio)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | String | `@id @default(cuid())` |
| `nombre` | String | max 200 |
| `estado` | Enum | activo \| inactivo |
| `creadoEn` | DateTime | `@default(now())` |

**Relationship**: `Usuario.tenantId` → `Tenant.id` (SCHOOL_ADMIN y usuarios de colegio)

---

### `Plan`, `Subscription`, `BillingCycle`

Tablas vacías para el modelo SaaS (constitución §2.4). Esquema definido con campos mínimos, sin datos iniciales.

---

## Entity Relationships

```
Usuario ||--o{ AuditLog : "genera"
Usuario ||--o{ ParametroSistema : "actualiza"
Tenant  ||--o{ Usuario : "contiene"

ParametroSistema : "audit log entry created on every update"
```

---

## Seed Data (Required)

### Roles (enum, no tabla)

```typescript
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
}
```

### Parámetros por Defecto

| Clave | Valor | Tipo | Categoría | Público | Descripción |
|-------|-------|------|-----------|---------|-------------|
| `visibility.report_threshold` | `3` | INTEGER | VISIBILITY | ✅ | Mínimo reportes independientes para visibilidad |
| `security.max_login_attempts` | `5` | INTEGER | SECURITY | ❌ | Intentos fallidos antes de bloqueo |
| `security.lockout_duration_minutes` | `30` | INTEGER | SECURITY | ❌ | Minutos de bloqueo |
| `security.password_min_length` | `12` | INTEGER | SECURITY | ✅ | Longitud mínima contraseña |
| `security.jwt_ttl_hours` | `24` | INTEGER | SECURITY | ❌ | Vida del token JWT en horas |
| `system.maintenance_mode` | `false` | BOOLEAN | SYSTEM | ✅ | Modo mantenimiento |

---

## Indexes

| Table | Fields | Reason |
|-------|--------|--------|
| `Usuario` | `email` | Login lookup |
| `Usuario` | `rol` | Filtering by role |
| `Usuario` | `estado` | Filtering active users |
| `Usuario` | `tenantId` | Multi-tenant queries (future) |
| `ParametroSistema` | `clave` | Lookup by key |
| `ParametroSistema` | `categoria` | Admin filtering |
| `AuditLog` | `usuarioId` | User activity queries |
| `AuditLog` | `accion` | Action type filtering |
| `AuditLog` | `creadoEn` | Time-range queries |