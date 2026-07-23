# Checklist de requisitos — Spec 019

**Spec**: `specs/019-permisos-modulos/spec.md` · **Verificado**: 2026-07-23 (post-implementación)

## Cambios obligatorios de ZEUS (re-especificación)

- [x] Permisos por ROL: `PermisoModulo(rol, moduloId, activo)`; capa por usuario eliminada.
- [x] `COMITE_VALIDACION` incluido (catálogo + backfill).
- [x] Submódulos: `padreId` nullable, AND jerárquico (módulo on + submódulos selectivos).
- [x] Anti-lockout configurable: `seguridad.permisos_roles_protegidos`; sin hardcodeo.
- [x] Sin motor genérico ni roles dinámicos: `rol` String absorbe roles nuevos con solo filas.

## Decisiones conservadas del owner

- [x] Denegar por defecto (sin fila → 403; verificado en tests y en vivo).
- [x] Validación backend por ruta (`assertModulo` en 83 route.ts).
- [x] Gestión desde `/dashboard/admin/configuracion` (tab "Permisos por rol").
- [x] `AuditLog` de cambios (`PERMISOS_MODULO_ACTUALIZADOS` con antes/después).
- [x] Anti-lockout verificado: 409 al dejar roles protegidos sin módulo crítico.

## Observaciones de la aprobación

- [x] Obs 1: `rol` validado al escribir → typo devuelve 400 con roles válidos, sin fila fantasma (test + live).
- [x] Obs 2: `cierre.md` lista explícitamente lo que queda SIN guard (páginas/layouts, rutas públicas por diseño, endpoint de worker).

## Calidad

- [x] Sin [NEEDS CLARIFICATION] pendientes.
- [x] Migración aditiva aplicada en dev y test; enum sincronizado migración ↔ schema.
- [x] Tests: helpers 5/5, endpoint 6/6, suite completa 764/764.
- [x] Artefactos Spec-Kit completos: spec, diseno, plan, research, data-model, contracts, quickstart, checklists, tasks, cierre.
- [ ] Validación funcional de Jelkin (v1.2) — PENDIENTE.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
