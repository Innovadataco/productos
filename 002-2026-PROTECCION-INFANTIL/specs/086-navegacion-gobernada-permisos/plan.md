# Implementation Plan: Spec 086 — Navegación y páginas gobernadas por permisos

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md) | **Mapeo**: [research.md](./research.md) (pendiente visto bueno ZEUS)

## Summary

La navegación y las páginas pasan a gobernarse por `PermisoModulo`: el layout server resuelve las claves activas del rol y las pasa a las navs (que filtran por `modulo`, sin `roles` quemados); las páginas verifican su módulo con un helper compartido y muestran "Sin acceso a este módulo"; el catálogo se alinea a lo visible (`revision_spam` nuevo, `reportes_revision` fusionado en `bandeja_reportes` con migración aditiva de datos).

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router, Server Components)
**Storage**: PostgreSQL — migración de DATOS aditiva (catálogo), sin cambios de schema
**Testing**: Vitest — test estructural menú↔catálogo, nav filtrada, guard de página, "sin acceso"
**Constraints**: no tocar modelo de permisos ni anti-lockout (spec 019); sin endpoint nuevo para la nav; migraciones aditivas con backfill.

## Constitution Check

| Regla | Evaluación |
|-------|------------|
| Migraciones aditivas | Solo INSERT/UPDATE/DELETE de filas de catálogo con backfill; sin schema, sin reset. |
| Spec Kit | Artefactos completos antes de implementar; mapeo aprobado por ZEUS. |
| ADR_004 parametrización | Es el núcleo del cambio: la nav se deriva de datos, no de código. |

## Fases (tras visto bueno del mapeo)

### Fase 1 — Catálogo y datos

1. Migración de datos `align_catalogo_navegacion` (§6 de research): `revision_spam` + backfill, fusión `reportes_revision`→`bandeja_reportes` (unión), borrado de fila de catálogo.
2. `src/lib/permisos-catalogo.ts`: +`revision_spam`, −`reportes_revision`.
3. Seed: backfill actualizado (OPERADOR: `bandeja_reportes` + `revision_spam`).

### Fase 2 — Re-claveo de guards API (~8 archivos)

4. `/api/admin/spam/**` → `revision_spam`; `/api/admin/reportes-revision/**` y `/api/admin/correcciones` → `bandeja_reportes`. Tests existentes deben seguir verdes (el grant cubre el catálogo nuevo).

### Fase 3 — Navegación por permisos (D-1)

5. Extraer ítems nav a `src/lib/nav-items.ts` (`{ href, label, modulo }` por nav: admin, comite, colegio).
6. `dashboard/admin/layout.tsx`: resolver `modulosPermitidos` del rol y pasarlos a `AdminNav`; `AdminNav({ modulosPermitidos })` filtra por `modulo`; eliminar `roles` de `allLinks`. Lo mismo `ColegioNav` (desde `colegio/layout.tsx`) y `ComiteSubNav` (prop desde páginas server).

### Fase 4 — Guard de página (D-2)

7. `src/lib/permisos-modulos.ts`: helper `verificarAccesoPagina(clave)` (token → rol → `puedeAccederAModulo`) + componente `SinAccesoModulo` ("Sin acceso a este módulo" + enlace de vuelta).
8. Aplicar en las páginas del mapeo §4 de research (`/dashboard/admin/**`, `/dashboard/colegio/**`).

### Fase 5 — Tests y cierre

9. Test estructural (§8 research) + tests de nav y guard.
10. Prueba del CEO (quickstart) + gate completo + dev-restart + cierre + commit/push.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Fusión de claves pierde acceso de alguien | Semántica unión en el backfill (OR); documentada en data-model.md |
| Páginas con lógica de rol adicional (p. ej. ComiteSubNav) | Reciben claves por prop desde sus páginas server; sin endpoint nuevo |
| Layout admin cachea permisos | El layout es dynamic por cookies; se reevalúa por request |

## Complexity Tracking

Sin violaciones de constitución.
