# Data Model — SPEC-105

**Date**: 2026-07-27 · Sin cambios de schema (no hay migración).

## Entidades (existentes, solo lectura/escritura puntuales del seed)

### Usuario (modelo Prisma existente)

Campos relevantes para esta spec:

| Campo | Tipo | Uso en la spec |
|-------|------|----------------|
| `email` | String @unique | Llave de existencia del admin (`findUnique`). |
| `passwordHash` | String | Se escribe SOLO en el `create` inicial, con bcrypt(12) del valor de `SEED_ADMIN_PASSWORD`. Nunca en `update`. |
| `rol` | RolUsuario | `ADMIN` para el admin inicial. |
| `estado` | String | `activo` en el create; si existe desactivado, el seed NO lo reactiva. |
| `debeCambiarPassword` | Boolean | `true` en el create (era `false` — es parte del defecto I-31). |

## Variable de entorno nueva (documentada, sin valor en git)

| Variable | Default | Validación |
|----------|---------|------------|
| `SEED_ADMIN_EMAIL` | `soporte@innovadataco.com` (no secreto) | formato email básico |
| `SEED_ADMIN_PASSWORD` | **ninguno** | longitud ≥ `security.password_min_length` (fallback 12); ausente/débil → omitir admin con log |

## Transiciones

- Base vacía + variable válida → admin creado (`debeCambiarPassword=true`).
- Admin existente (cualquier estado/contraseña) → sin cambios (el seed no lo toca).
- Variable ausente/débil → admin no creado; el resto del seed completa.
