# Implementation Plan: Spec 019 — Gestor de permisos de módulos por ROL

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md) | **Diseño**: [diseno.md](./diseno.md)

## Summary

Gestor de permisos de módulos por ROL (no por usuario): `PermisoModulo(rol, moduloId, activo)` con `rol` como String (absorbe roles futuros sin refactor), `ModuloPermisible` con jerarquía padre/hijo de un nivel, denegar por defecto, guard backend por ruta, anti-lockout configurable vía `ParametroSistema`, gestión desde `/dashboard/admin/configuracion` y auditoría de cambios. Sin motor genérico ni roles dinámicos.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16, Prisma 5.22
**Storage**: PostgreSQL — 2 tablas nuevas + 1 valor de enum (migración aditiva)
**Testing**: Vitest (helpers, endpoints, aislamiento por rol, anti-lockout, absorción de rol nuevo)
**Constraints**: migración aditiva; sin hardcodeo de roles protegidos; sin capa por usuario; sin CRUD de roles; adopción incremental de guards.

## Constitution Check

| Regla | Evaluación |
|-------|------------|
| Migraciones aditivas | 2 tablas nuevas + `ALTER TYPE AccionAudit ADD VALUE`; sin alterar ni borrar datos. |
| Spec Kit | Cumplido (spec + diseño + plan antes de implementar). |
| Secrets por env | Sin impacto. |
| Restricciones de producto | Sin impacto (módulo admin interno). |

Sin violaciones.

## Fases

### Fase 1 — Datos y helpers (FR-001/002/003)

1. Migración `add_permisos_modulos`: `ModuloPermisible` (con `padreId` self-FK Restrict), `PermisoModulo` (`rol` String, `@@unique([rol, moduloId])`), `ALTER TYPE "AccionAudit" ADD VALUE 'PERMISOS_MODULO_ACTUALIZADOS'`.
2. Seed: catálogo con submódulos (spec §Catálogo) + backfill por rol (ADMIN todo; SCHOOL_ADMIN colegios; OPERADOR bandeja/revisión; COMITE_VALIDACION comité) + parámetro `seguridad.permisos_roles_protegidos = ["ADMIN"]`.
3. `src/lib/permisos-modulos.ts`: `puedeAccederAModulo(rol, clave)` (AND jerárquico), `requireModulo(request, clave)` (403), `rolesConPermisos()` (DISTINCT rol).
4. Tests de helpers: denegar por defecto, jerarquía AND, rol libre (`FISCALIA`).

### Fase 2 — Endpoints y auditoría (FR-005/006/008)

5. `GET /api/admin/permisos-modulos` (matriz roles × árbol).
6. `PATCH /api/admin/permisos-modulos`: validación anti-lockout simulando estado final sobre roles protegidos del parámetro; transacción; `AuditLog` antes/después; `actualizadoPorId`.
7. Tests: anti-lockout 409 (1 y 2 roles protegidos), audit registrado, 403 no-ADMIN.

### Fase 3 — UI (FR-004/007)

8. Tab "Permisos por rol" en `/dashboard/admin/configuracion`: selector de rol (desde datos), árbol con toggles, críticos con candado, guardado PATCH + manejo de 409.

### Fase 4 — Adopción incremental de guards (FR-006)

9. `requireModulo` en los módulos del catálogo inicial: centro de control IA (con submódulos), operadores, comité, colegios, configuración, audit-logs, estadísticas, anti-abuso, apelaciones, dataset. Guard en layouts de las páginas correspondientes.
10. Tests de integración por módulo (p. ej. `colegio/auditoria` con submódulo inactivo → 403).

### Fase 5 — Cierre

11. Gate completo + `dev-restart.sh` + quickstart + cierre.md + índice + commit.

## Contratos

- `GET /api/admin/permisos-modulos` → `{ roles: string[], modulos: [{ id, clave, nombre, esCritico, submodulos: [...] }], permisos: [{ rol, moduloId, activo }] }`
- `PATCH /api/admin/permisos-modulos` ← `{ cambios: [{ rol, moduloId, activo }] }` (1..100) → 200 `{ actualizados: N }` · 400 validación · 403 no-ADMIN · 409 anti-lockout.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Lockout | Anti-lockout por parámetro + backfill fiel + tests dedicados |
| Big-bang | Capa adicional sobre `verifyAuth` (no reemplaza), adopción por módulos |
| Sobrediseño | Prohibido por spec: sin usuarios, sin entidades dinámicas, 1 nivel de jerarquía |

## Fuera de alcance (explícito)

- Overrides por usuario individual.
- CRUD de roles / roles dinámicos desde UI.
- Motor genérico de entidades (padres, fiscalía, ICBF, policía llegarán como roles que el modelo absorbe con filas, cuando se definan).
- Permisos por acción (solo por módulo/submódulo).
