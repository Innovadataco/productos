# Data Model — 086-navegacion-gobernada-permisos

> Migración de DATOS aditiva `prisma/migrations/20260723120000_align_catalogo_navegacion/migration.sql`.
> **Sin cambios de schema** (el modelo de permisos de la spec 019 no se toca). Aplicada en dev y test.

## Cambios de catálogo

| Acción | Detalle |
|---|---|
| INSERT | `ModuloPermisible` clave `revision_spam` ("Revisión de spam", categoría `operador`, orden 35, no crítico) |
| INSERT backfill | `PermisoModulo` para `revision_spam`: **solo copia desde `anti_abuso`** por rol (denegado por defecto, corrección 2 de ZEUS) |
| UPDATE fusión | `bandeja_reportes.activo = bandeja_reportes.activo AND reportes_revision.activo` por rol (**semántica AND**, corrección 1: ante la duda se restringe) |
| DELETE | filas `PermisoModulo` y fila de catálogo de `reportes_revision` (fusionada) |

## Semántica de la fusión (AND) y reporte de restringidos

- Roles con ambas claves activas: conservan acceso (t AND t = t).
- Roles con ambas inactivas: sin cambio (f AND f = f).
- Roles con divergencia (una activa y otra no): quedan **restringidos** (AND = f). En dev no había divergencia al momento de aplicar (verificado: ADMIN t/t, OPERADOR f/f) → **ningún rol quedó restringido en esta aplicación**. Si en otro entorno apareciera divergencia, debe listarse (rol, módulo) en el cierre del despliegue.
- Roles con fila solo en `reportes_revision` y sin fila en `bandeja_reportes`: AND con "sin fila" (= denegado) ⇒ denegado. Se reporta si existe (en dev: ninguno).

## Mapa de navegación → módulo (fuente: `src/lib/nav-items.ts`)

Ver `research.md` §2 (tabla completa). El test estructural `src/lib/nav-items.test.ts` garantiza menú ↔ catálogo.

## Invariantes que NO cambiaron

- Schema de `ModuloPermisible` / `PermisoModulo` (spec 019): intacto.
- Anti-lockout (`seguridad.permisos_roles_protegidos`): intacto.
- AuditLog histórico: intacto (los registros con texto "reportes_revision" en valores quedan como historia).
