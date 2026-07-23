# Data Model — 019-permisos-modulos

> Verificado 1:1 contra la migración `prisma/migrations/20260723090000_add_permisos_modulos/migration.sql`
> y `prisma/schema.prisma`. Migración **ADITIVA** (2 tablas nuevas + 1 valor de enum; no altera ni borra
> datos existentes). Aplicada en dev y test.

## ModuloPermisible → `ModuloPermisible`

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | TEXT (cuid) | NO | `cuid()` | PK |
| `clave` | TEXT | NO | — | UNIQUE; identificador estable usado por los guards (`assertModulo(user, clave)`) |
| `nombre` | TEXT | NO | — | Etiqueta para UI |
| `descripcion` | TEXT | SÍ | null | |
| `padreId` | TEXT | SÍ | null | Self-FK → `ModuloPermisible.id`, `ON DELETE RESTRICT` (no se borra un módulo con hijos). null = raíz |
| `categoria` | TEXT | NO | — | `admin` \| `operador` \| `comite` \| `colegio` |
| `esCritico` | BOOLEAN | NO | `false` | Sujeto a anti-lockout |
| `orden` | INTEGER | NO | `0` | Orden de presentación |
| `creadoEn` / `actualizadoEn` | TIMESTAMP(3) | NO | `now()` / `@updatedAt` | |

Índices: `ModuloPermisible_clave_key` (unique), `ModuloPermisible_padreId_idx`.
Relaciones: `padre`, `submodulos`, `permisos`.

## PermisoModulo → `PermisoModulo`

| Columna | Tipo | Nulo | Default | Notas |
|---|---|---|---|---|
| `id` | TEXT (cuid) | NO | `cuid()` | PK |
| `rol` | TEXT | NO | — | **String deliberado** (no enum): absorbe roles futuros con solo filas (R2) |
| `moduloId` | TEXT | NO | — | FK → `ModuloPermisible.id`, `ON DELETE CASCADE` |
| `activo` | BOOLEAN | NO | `false` | Denegar por defecto |
| `actualizadoPorId` | TEXT | SÍ | null | FK → `Usuario.id`, `ON DELETE SET NULL`; trazabilidad del último cambio |
| `creadoEn` / `actualizadoEn` | TIMESTAMP(3) | NO | `now()` / `@updatedAt` | |

Índices: `PermisoModulo_rol_moduloId_key` (unique `[rol, moduloId]`), `PermisoModulo_rol_idx`.

## Alteración de enum

```sql
ALTER TYPE "AccionAudit" ADD VALUE 'PERMISOS_MODULO_ACTUALIZADOS';
```

Lección incorporada: el valor debe existir A LA VEZ en la migración y en el enum del
`schema.prisma` — la primera versión solo lo puso en la migración y el cliente generado
rechazaba la escritura de auditoría (detectado por test, corregido en el mismo commit).

## Relaciones tocadas en modelos existentes

- `Usuario.permisosModuloActualizados PermisoModulo[]` (back-relation de `actualizadoPorId`). No se añaden columnas a `Usuario`.

## Semillas y backfill (idempotente, `prisma/seed.ts`)

- Catálogo: 21 módulos (fuente única `src/lib/permisos-catalogo.ts`), con 8 submódulos sobre 4 raíces.
- Backfill por rol (reproduce el acceso implícito previo):
  - `ADMIN` → los 21 módulos activos.
  - `SCHOOL_ADMIN` → `colegios`, `colegios_gestion`, `colegios_auditoria`.
  - `OPERADOR` → `bandeja_reportes`, `reportes_revision`.
  - `COMITE_VALIDACION` → `comite`, `comite_bandeja`, `comite_auditoria`.
- Parámetro `seguridad.permisos_roles_protegidos` = `["ADMIN"]` (STRING_ARRAY, SECURITY).

## Reglas de integridad

- Borrar un módulo raíz con hijos: bloqueado (RESTRICT).
- Borrar un módulo: sus permisos caen en cascada (CASCADE).
- Borrar el usuario que modificó un permiso: `actualizadoPorId` → NULL (SET NULL), la fila de permiso sobrevive.
