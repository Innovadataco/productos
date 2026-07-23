# Tasks — Spec 019: Gestor de permisos de módulos por ROL

**Spec**: `specs/019-permisos-modulos/spec.md` · **Diseño**: `diseno.md` · **Fecha**: 2026-07-23

## Fase 1 — Datos y helpers

- [x] T001 Migración aditiva `add_permisos_modulos`: `ModuloPermisible` (padreId self-FK), `PermisoModulo` (rol String, unique [rol, moduloId]), `AccionAudit + PERMISOS_MODULO_ACTUALIZADOS`.
- [x] T002 Seed: catálogo con submódulos + backfill por rol + parámetro `seguridad.permisos_roles_protegidos` (["ADMIN"]).
- [x] T003 `src/lib/permisos-modulos.ts`: `puedeAccederAModulo`, `requireModulo`, `rolesConocidos` (enum RolUsuario ∪ DISTINCT rol), matriz.
- [x] T004 Tests helpers: denegar por defecto, AND jerárquico, rol libre.

## Fase 2 — Endpoints (con observación 1 de ZEUS)

- [x] T005 `GET /api/admin/permisos-modulos` (matriz roles × árbol).
- [x] T006 `PATCH /api/admin/permisos-modulos`: valida `rol` contra roles conocidos (typo → 400 claro, sin fila fantasma); anti-lockout por parámetro; AuditLog.
- [x] T007 Tests endpoints.

## Fase 3 — UI

- [x] T008 Tab "Permisos por rol" en `/dashboard/admin/configuracion`.

## Fase 4 — Adopción incremental de guards

- [x] T009 `requireModulo` en: centro control IA (+submódulos), operadores, comité, colegios (+auditoría), configuración, audit-logs, estadísticas, anti-abuso, apelaciones, dataset.
- [x] T010 Tests de integración por módulo.

## Fase 5 — Cierre

- [x] T011 Gate + `dev-restart.sh` + app accesible por web (v1.2) para validación de Jelkin.
- [x] T012 cierre.md con lista explícita de módulos SIN `requireModulo` (observación 2) + docs + commit.

**Nota de cierre**: funcionalidad completa → requiere validación funcional de Jelkin antes de Status CERRADA.
